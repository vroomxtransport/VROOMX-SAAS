'use server'

import { revalidatePath } from 'next/cache'
import { authorize, safeError } from '@/lib/authz'
import {
  workOrderCreateSchema,
  workOrderUpdateSchema,
  setWorkOrderStatusSchema,
  workOrderItemSchema,
  workOrderItemUpdateSchema,
  workOrderNoteCreateSchema,
  workOrderDuplicateSchema,
} from '@/lib/validations/work-order'
import { computeWorkOrderTotals } from '@/lib/financial/work-order-totals'
import { isTransitionAllowed } from '@/lib/work-orders/transitions'
import type { MaintenanceStatus } from '@/types'
import type { WorkOrder, WorkOrderItem, WorkOrderNote } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

type ActionErr = { error: string | Record<string, string[]> }

function revalidateWorkOrderRoutes(workOrderId?: string) {
  revalidatePath('/maintenance')
  if (workOrderId) revalidatePath(`/maintenance/${workOrderId}`)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Re-sum line items and write totals back to the parent work order.
 * `cost` is kept in sync with `grand_total` so the truck-expense-ledger
 * (which still reads `cost`) sees the same number as the new UI.
 */
async function recomputeWorkOrderTotals(
  admin: SupabaseClient,
  tenantId: string,
  workOrderId: string,
): Promise<{ error: string | null; totals: { totalLabor: string; totalParts: string; grandTotal: string } }> {
  const { data: items, error: selectErr } = await admin
    .from('work_order_items')
    .select('kind, amount')
    .eq('tenant_id', tenantId)
    .eq('work_order_id', workOrderId)

  if (selectErr) return { error: selectErr.message, totals: { totalLabor: '0.00', totalParts: '0.00', grandTotal: '0.00' } }

  const totals = computeWorkOrderTotals(
    (items ?? []).map((i: { kind: 'labor' | 'part'; amount: string }) => ({
      kind: i.kind,
      amount: i.amount,
    })),
  )

  const { error: updateErr } = await admin
    .from('maintenance_records')
    .update({
      total_labor: totals.totalLabor,
      total_parts: totals.totalParts,
      grand_total: totals.grandTotal,
      cost: totals.grandTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workOrderId)
    .eq('tenant_id', tenantId)

  return { error: updateErr?.message ?? null, totals }
}

/**
 * Atomic next-WO-number assignment per tenant. Uses a tenant-scoped advisory
 * lock so two concurrent createWorkOrder calls can't collide. The unique
 * index on (tenant_id, wo_number) is the belt; the advisory lock is the
 * suspenders.
 */
async function nextWoNumber(
  admin: SupabaseClient,
  tenantId: string,
): Promise<{ wo: number | null; error: string | null }> {
  const { data, error } = await admin.rpc('nextval_wo_number', { p_tenant_id: tenantId })
  if (error || typeof data !== 'number') {
    // Fallback: read max + 1 (safe because of the unique index).
    const { data: max, error: maxErr } = await admin
      .from('maintenance_records')
      .select('wo_number')
      .eq('tenant_id', tenantId)
      .order('wo_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxErr) return { wo: null, error: maxErr.message }
    const next = ((max?.wo_number as number | null) ?? 999) + 1
    return { wo: next, error: null }
  }
  return { wo: data, error: null }
}

// ---------------------------------------------------------------------------
// Header CRUD
// ---------------------------------------------------------------------------

export async function createWorkOrder(
  data: unknown,
): Promise<({ success: true; workOrder: WorkOrder }) | ActionErr> {
  const parsed = workOrderCreateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.create', {
      rateLimit: { key: 'createWorkOrder', limit: 30, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { wo, error: woErr } = await nextWoNumber(admin, tenantId)
    if (woErr || wo == null) return { error: safeError({ message: woErr ?? 'Could not allocate WO number' }, 'createWorkOrder.woNumber') }

    const { data: inserted, error } = await admin
      .from('maintenance_records')
      .insert({
        tenant_id: tenantId,
        shop_id: parsed.data.shopId,
        truck_id: parsed.data.truckId ?? null,
        trailer_id: parsed.data.trailerId ?? null,
        wo_number: wo,
        status: 'new',
        maintenance_type: parsed.data.maintenanceType,
        description: parsed.data.description || null,
        scheduled_date: parsed.data.scheduledDate || null,
        odometer: parsed.data.odometer ?? null,
        notes: parsed.data.notes || null,
        total_labor: '0',
        total_parts: '0',
        grand_total: '0',
        cost: '0',
      })
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'createWorkOrder') }

    revalidateWorkOrderRoutes(inserted.id)
    return { success: true, workOrder: inserted as WorkOrder }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'createWorkOrder.throw') }
  }
}

export async function updateWorkOrder(
  id: string,
  data: unknown,
): Promise<({ success: true; workOrder: WorkOrder }) | ActionErr> {
  if (!id) return { error: 'Work order id is required.' }
  const parsed = workOrderUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'updateWorkOrder', limit: 60, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.shopId !== undefined) updates.shop_id = parsed.data.shopId
    if (parsed.data.truckId !== undefined) updates.truck_id = parsed.data.truckId
    if (parsed.data.trailerId !== undefined) updates.trailer_id = parsed.data.trailerId
    if (parsed.data.description !== undefined) updates.description = parsed.data.description || null
    if (parsed.data.maintenanceType !== undefined) updates.maintenance_type = parsed.data.maintenanceType
    if (parsed.data.scheduledDate !== undefined) updates.scheduled_date = parsed.data.scheduledDate || null
    if (parsed.data.odometer !== undefined) updates.odometer = parsed.data.odometer
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null

    const { supabase: admin } = auth.ctx
    const { data: updated, error } = await admin
      .from('maintenance_records')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'updateWorkOrder') }
    if (!updated) return { error: 'Work order not found.' }

    revalidateWorkOrderRoutes(id)
    return { success: true, workOrder: updated as WorkOrder }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'updateWorkOrder.throw') }
  }
}

/** Hard delete only allowed while the WO is still 'new'. */
export async function deleteWorkOrder(
  id: string,
): Promise<{ success: true } | ActionErr> {
  if (!id) return { error: 'Work order id is required.' }

  try {
    const auth = await authorize('maintenance.delete', {
      rateLimit: { key: 'deleteWorkOrder', limit: 20, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { data: existing, error: selectErr } = await admin
      .from('maintenance_records')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (selectErr) return { error: safeError(selectErr, 'deleteWorkOrder.select') }
    if (!existing) return { error: 'Work order not found.' }
    if (existing.status !== 'new') {
      return { error: 'Only work orders in the New state can be deleted. Close it instead.' }
    }

    const { error } = await admin
      .from('maintenance_records')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) return { error: safeError(error, 'deleteWorkOrder') }

    revalidateWorkOrderRoutes()
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'deleteWorkOrder.throw') }
  }
}

export async function setWorkOrderStatus(
  data: unknown,
): Promise<({ success: true; status: MaintenanceStatus }) | ActionErr> {
  const parsed = setWorkOrderStatusSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    // Closing requires the elevated permission; everything else is regular update.
    const requiredPerm = parsed.data.status === 'closed' ? 'maintenance.close' : 'maintenance.update'
    const auth = await authorize(requiredPerm, {
      rateLimit: { key: 'setWorkOrderStatus', limit: 60, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { data: existing, error: selectErr } = await admin
      .from('maintenance_records')
      .select('id, status')
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (selectErr) return { error: safeError(selectErr, 'setWorkOrderStatus.select') }
    if (!existing) return { error: 'Work order not found.' }

    const from = existing.status as MaintenanceStatus
    const to = parsed.data.status
    if (!isTransitionAllowed(from, to)) {
      return { error: `Cannot transition from ${from} to ${to}.` }
    }

    const updates: Record<string, unknown> = {
      status: to,
      updated_at: new Date().toISOString(),
    }
    if (to === 'closed') updates.closed_at = new Date().toISOString()
    if (to === 'completed') updates.completed_date = new Date().toISOString()
    if (from === 'closed' && to !== 'closed') updates.closed_at = null

    const { error: updateErr } = await admin
      .from('maintenance_records')
      .update(updates)
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)

    if (updateErr) return { error: safeError(updateErr, 'setWorkOrderStatus.update') }

    revalidateWorkOrderRoutes(parsed.data.id)
    return { success: true, status: to }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'setWorkOrderStatus.throw') }
  }
}

// ---------------------------------------------------------------------------
// Line items
// ---------------------------------------------------------------------------

export async function addWorkOrderItem(
  data: unknown,
): Promise<({ success: true; item: WorkOrderItem }) | ActionErr> {
  const parsed = workOrderItemSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'addWorkOrderItem', limit: 120, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const qty = Number(parsed.data.quantity ?? 1)
    const rate = Number(parsed.data.unitRate ?? 0)
    const amount = (qty * rate).toFixed(2)

    const { supabase: admin } = auth.ctx
    const { data: inserted, error } = await admin
      .from('work_order_items')
      .insert({
        tenant_id: tenantId,
        work_order_id: parsed.data.workOrderId,
        kind: parsed.data.kind,
        description: parsed.data.description,
        quantity: String(qty),
        unit_rate: String(rate),
        amount,
        mechanic_name: parsed.data.mechanicName || null,
        service_date: parsed.data.serviceDate || null,
        sort_order: parsed.data.sortOrder ?? 0,
      })
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'addWorkOrderItem') }

    const recompute = await recomputeWorkOrderTotals(admin, tenantId, parsed.data.workOrderId)
    if (recompute.error) return { error: safeError({ message: recompute.error }, 'addWorkOrderItem.recompute') }

    revalidateWorkOrderRoutes(parsed.data.workOrderId)
    return { success: true, item: inserted as WorkOrderItem }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'addWorkOrderItem.throw') }
  }
}

export async function updateWorkOrderItem(
  data: unknown,
): Promise<({ success: true; item: WorkOrderItem }) | ActionErr> {
  const parsed = workOrderItemUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'updateWorkOrderItem', limit: 240, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx

    // Fetch the row to know which work_order to recompute + to derive amount
    // when only one of (quantity, unitRate) is changed.
    const { data: existing, error: selectErr } = await admin
      .from('work_order_items')
      .select('id, work_order_id, quantity, unit_rate')
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (selectErr) return { error: safeError(selectErr, 'updateWorkOrderItem.select') }
    if (!existing) return { error: 'Line item not found.' }

    const nextQty = parsed.data.quantity != null ? Number(parsed.data.quantity) : Number(existing.quantity)
    const nextRate = parsed.data.unitRate != null ? Number(parsed.data.unitRate) : Number(existing.unit_rate)

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      quantity: String(nextQty),
      unit_rate: String(nextRate),
      amount: (nextQty * nextRate).toFixed(2),
    }
    if (parsed.data.kind !== undefined) updates.kind = parsed.data.kind
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.mechanicName !== undefined) updates.mechanic_name = parsed.data.mechanicName || null
    if (parsed.data.serviceDate !== undefined) updates.service_date = parsed.data.serviceDate || null
    if (parsed.data.sortOrder !== undefined) updates.sort_order = parsed.data.sortOrder

    const { data: updated, error } = await admin
      .from('work_order_items')
      .update(updates)
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'updateWorkOrderItem') }

    const recompute = await recomputeWorkOrderTotals(admin, tenantId, existing.work_order_id)
    if (recompute.error) return { error: safeError({ message: recompute.error }, 'updateWorkOrderItem.recompute') }

    revalidateWorkOrderRoutes(existing.work_order_id)
    return { success: true, item: updated as WorkOrderItem }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'updateWorkOrderItem.throw') }
  }
}

export async function deleteWorkOrderItem(
  id: string,
): Promise<{ success: true } | ActionErr> {
  if (!id) return { error: 'Item id is required.' }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'deleteWorkOrderItem', limit: 120, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { data: existing, error: selectErr } = await admin
      .from('work_order_items')
      .select('id, work_order_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (selectErr) return { error: safeError(selectErr, 'deleteWorkOrderItem.select') }
    if (!existing) return { error: 'Line item not found.' }

    const { error } = await admin
      .from('work_order_items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) return { error: safeError(error, 'deleteWorkOrderItem') }

    const recompute = await recomputeWorkOrderTotals(admin, tenantId, existing.work_order_id)
    if (recompute.error) return { error: safeError({ message: recompute.error }, 'deleteWorkOrderItem.recompute') }

    revalidateWorkOrderRoutes(existing.work_order_id)
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'deleteWorkOrderItem.throw') }
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addWorkOrderNote(
  data: unknown,
): Promise<({ success: true; note: WorkOrderNote }) | ActionErr> {
  const parsed = workOrderNoteCreateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'addWorkOrderNote', limit: 60, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId, user } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { data: inserted, error } = await admin
      .from('work_order_notes')
      .insert({
        tenant_id: tenantId,
        work_order_id: parsed.data.workOrderId,
        author_id: user?.id ?? null,
        body: parsed.data.body,
      })
      .select('*')
      .single()

    if (error) return { error: safeError(error, 'addWorkOrderNote') }

    revalidateWorkOrderRoutes(parsed.data.workOrderId)
    return { success: true, note: inserted as WorkOrderNote }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'addWorkOrderNote.throw') }
  }
}

export async function deleteWorkOrderNote(
  id: string,
): Promise<{ success: true } | ActionErr> {
  if (!id) return { error: 'Note id is required.' }

  try {
    const auth = await authorize('maintenance.update', {
      rateLimit: { key: 'deleteWorkOrderNote', limit: 60, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx
    const { data: existing, error: selectErr } = await admin
      .from('work_order_notes')
      .select('id, work_order_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (selectErr) return { error: safeError(selectErr, 'deleteWorkOrderNote.select') }
    if (!existing) return { error: 'Note not found.' }

    const { error } = await admin
      .from('work_order_notes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) return { error: safeError(error, 'deleteWorkOrderNote') }

    revalidateWorkOrderRoutes(existing.work_order_id)
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'deleteWorkOrderNote.throw') }
  }
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export async function duplicateWorkOrder(
  data: unknown,
): Promise<({ success: true; workOrderId: string; woNumber: number }) | ActionErr> {
  const parsed = workOrderDuplicateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  try {
    const auth = await authorize('maintenance.create', {
      rateLimit: { key: 'duplicateWorkOrder', limit: 30, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { tenantId } = auth.ctx

    const { supabase: admin } = auth.ctx

    const { data: source, error: srcErr } = await admin
      .from('maintenance_records')
      .select('shop_id, truck_id, trailer_id, maintenance_type, description, scheduled_date, odometer, notes')
      .eq('id', parsed.data.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (srcErr) return { error: safeError(srcErr, 'duplicateWorkOrder.source') }
    if (!source) return { error: 'Work order not found.' }

    const { wo, error: woErr } = await nextWoNumber(admin, tenantId)
    if (woErr || wo == null) return { error: safeError({ message: woErr ?? 'Could not allocate WO number' }, 'duplicateWorkOrder.woNumber') }

    const { data: created, error: insertErr } = await admin
      .from('maintenance_records')
      .insert({
        tenant_id: tenantId,
        shop_id: source.shop_id,
        truck_id: source.truck_id,
        trailer_id: source.trailer_id,
        wo_number: wo,
        status: 'new',
        maintenance_type: source.maintenance_type,
        description: source.description,
        scheduled_date: source.scheduled_date,
        odometer: source.odometer,
        notes: source.notes,
        total_labor: '0',
        total_parts: '0',
        grand_total: '0',
        cost: '0',
      })
      .select('id')
      .single()
    if (insertErr || !created) return { error: safeError(insertErr ?? { message: 'insert failed' }, 'duplicateWorkOrder.insert') }

    // Clone line items — reset service_date + mechanic_name as those are per-execution.
    const { data: items, error: itemsErr } = await admin
      .from('work_order_items')
      .select('kind, description, quantity, unit_rate, amount, sort_order')
      .eq('tenant_id', tenantId)
      .eq('work_order_id', parsed.data.id)
    if (itemsErr) return { error: safeError(itemsErr, 'duplicateWorkOrder.items') }

    if (items && items.length > 0) {
      const rows = items.map((it: { kind: string; description: string; quantity: string; unit_rate: string; amount: string; sort_order: number }) => ({
        tenant_id: tenantId,
        work_order_id: created.id,
        kind: it.kind,
        description: it.description,
        quantity: it.quantity,
        unit_rate: it.unit_rate,
        amount: it.amount,
        sort_order: it.sort_order,
      }))
      const { error: copyErr } = await admin.from('work_order_items').insert(rows)
      if (copyErr) return { error: safeError(copyErr, 'duplicateWorkOrder.copyItems') }
    }

    const recompute = await recomputeWorkOrderTotals(admin, tenantId, created.id)
    if (recompute.error) return { error: safeError({ message: recompute.error }, 'duplicateWorkOrder.recompute') }

    revalidateWorkOrderRoutes(created.id)
    return { success: true, workOrderId: created.id, woNumber: wo }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'duplicateWorkOrder.throw') }
  }
}
