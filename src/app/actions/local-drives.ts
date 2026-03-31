'use server'

import { authorize, safeError } from '@/lib/authz'
import { localDriveSchema } from '@/lib/validations/local-drive'
import { revalidatePath } from 'next/cache'

export async function createLocalDrive(data: unknown) {
  const parsed = localDriveSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('local_drives.create', { rateLimit: { key: 'createLocalDrive', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Auto-fill locations based on type + order + terminal
  let pickupLocation = v.pickupLocation || null
  let pickupCity = v.pickupCity || null
  let pickupState = v.pickupState || null
  let deliveryLocation = v.deliveryLocation || null
  let deliveryCity = v.deliveryCity || null
  let deliveryState = v.deliveryState || null

  if (v.orderId && v.terminalId) {
    // Fetch order and terminal for auto-fill
    const [{ data: order }, { data: terminal }] = await Promise.all([
      supabase.from('orders').select('pickup_location, pickup_city, pickup_state, delivery_location, delivery_city, delivery_state').eq('id', v.orderId).eq('tenant_id', tenantId).single(),
      supabase.from('terminals').select('name, address, city, state').eq('id', v.terminalId).eq('tenant_id', tenantId).single(),
    ])

    if (v.type === 'pickup_to_terminal' && order && terminal) {
      pickupLocation = pickupLocation || order.pickup_location
      pickupCity = pickupCity || order.pickup_city
      pickupState = pickupState || order.pickup_state
      deliveryLocation = deliveryLocation || terminal.address || terminal.name
      deliveryCity = deliveryCity || terminal.city
      deliveryState = deliveryState || terminal.state
    } else if (v.type === 'delivery_from_terminal' && order && terminal) {
      pickupLocation = pickupLocation || terminal.address || terminal.name
      pickupCity = pickupCity || terminal.city
      pickupState = pickupState || terminal.state
      deliveryLocation = deliveryLocation || order.delivery_location
      deliveryCity = deliveryCity || order.delivery_city
      deliveryState = deliveryState || order.delivery_state
    }
  }

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .insert({
      tenant_id: tenantId,
      order_id: v.orderId || null,
      driver_id: v.driverId || null,
      truck_id: v.truckId || null,
      type: v.type,
      terminal_id: v.terminalId || null,
      local_run_id: v.localRunId || null,
      trip_id: v.tripId || null,
      pickup_location: pickupLocation,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      delivery_location: deliveryLocation,
      delivery_city: deliveryCity,
      delivery_state: deliveryState,
      scheduled_date: v.scheduledDate || null,
      revenue: String(v.revenue),
      expense_amount: String(v.expenseAmount),
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createLocalDrive') }
  }

  revalidatePath('/local-drives')
  return { success: true, data: localDrive }
}

export async function updateLocalDrive(id: string, data: unknown) {
  const parsed = localDriveSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('local_drives.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .update({
      order_id: v.orderId || null,
      driver_id: v.driverId || null,
      truck_id: v.truckId || null,
      type: v.type,
      terminal_id: v.terminalId || null,
      local_run_id: v.localRunId || null,
      trip_id: v.tripId || null,
      pickup_location: v.pickupLocation || null,
      pickup_city: v.pickupCity || null,
      pickup_state: v.pickupState || null,
      delivery_location: v.deliveryLocation || null,
      delivery_city: v.deliveryCity || null,
      delivery_state: v.deliveryState || null,
      scheduled_date: v.scheduledDate || null,
      revenue: String(v.revenue),
      expense_amount: String(v.expenseAmount),
      notes: v.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateLocalDrive') }
  }

  revalidatePath('/local-drives')
  return { success: true, data: localDrive }
}

export async function deleteLocalDrive(id: string) {
  const auth = await authorize('local_drives.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('local_drives')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteLocalDrive') }
  }

  revalidatePath('/local-drives')
  return { success: true }
}

export async function updateLocalDriveStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const auth = await authorize('local_drives.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const updateData: Record<string, string> = { status }
  if (status === 'completed') {
    updateData.completed_date = new Date().toISOString()
  }

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateLocalDriveStatus') }
  }

  revalidatePath('/local-drives')
  return { success: true, data: localDrive }
}
