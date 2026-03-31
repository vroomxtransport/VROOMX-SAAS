'use server'

import { authorize, safeError } from '@/lib/authz'
import { localRunSchema } from '@/lib/validations/local-run'
import { revalidatePath } from 'next/cache'
import type { LocalRunStatus } from '@/types'

const VALID_LOCAL_RUN_STATUSES: LocalRunStatus[] = ['planned', 'in_progress', 'completed', 'cancelled']

export async function createLocalRun(data: unknown) {
  const parsed = localRunSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('local_runs.create', { rateLimit: { key: 'createLocalRun', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: localRun, error } = await supabase
    .from('local_runs')
    .insert({
      tenant_id: tenantId,
      terminal_id: v.terminalId || null,
      driver_id: v.driverId || null,
      truck_id: v.truckId || null,
      type: v.type,
      scheduled_date: v.scheduledDate || null,
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createLocalRun') }
  }

  revalidatePath('/local-runs')
  return { success: true, data: localRun }
}

export async function updateLocalRun(id: string, data: unknown) {
  const parsed = localRunSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('local_runs.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: localRun, error } = await supabase
    .from('local_runs')
    .update({
      terminal_id: v.terminalId || null,
      driver_id: v.driverId || null,
      truck_id: v.truckId || null,
      type: v.type,
      scheduled_date: v.scheduledDate || null,
      notes: v.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateLocalRun') }
  }

  revalidatePath('/local-runs')
  return { success: true, data: localRun }
}

export async function deleteLocalRun(id: string) {
  const auth = await authorize('local_runs.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Unassign all local_drives from this run first
  await supabase
    .from('local_drives')
    .update({ local_run_id: null })
    .eq('local_run_id', id)
    .eq('tenant_id', tenantId)

  const { error } = await supabase
    .from('local_runs')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteLocalRun') }
  }

  revalidatePath('/local-runs')
  revalidatePath('/local-drives')
  return { success: true }
}

export async function updateLocalRunStatus(id: string, newStatus: LocalRunStatus) {
  if (!VALID_LOCAL_RUN_STATUSES.includes(newStatus)) {
    return { error: 'Invalid local run status' }
  }

  const auth = await authorize('local_runs.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'completed') {
    updateData.completed_date = new Date().toISOString()

    // Calculate total_expense based on driver pay type
    const { data: run } = await supabase
      .from('local_runs')
      .select('driver_id, local_drives(expense_amount)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (run) {
      // Sum individual drive expenses
      const drives = (run.local_drives ?? []) as Array<{ expense_amount: string }>
      const totalExpense = drives.reduce((sum, d) => sum + parseFloat(d.expense_amount || '0'), 0)

      // If driver has daily_salary pay type, use that instead
      if (run.driver_id) {
        const { data: driver } = await supabase
          .from('drivers')
          .select('pay_type, pay_rate')
          .eq('id', run.driver_id)
          .eq('tenant_id', tenantId)
          .single()

        if (driver?.pay_type === 'daily_salary') {
          updateData.total_expense = String(parseFloat(driver.pay_rate || '0'))
        } else if (driver?.pay_type === 'per_car') {
          // Count vehicles in all drives for this run
          const { data: runDrives } = await supabase
            .from('local_drives')
            .select('order_id')
            .eq('local_run_id', id)
            .eq('tenant_id', tenantId)

          const vehicleCount = runDrives?.length ?? 0
          updateData.total_expense = String(parseFloat(driver?.pay_rate || '0') * vehicleCount)
        } else {
          updateData.total_expense = String(totalExpense)
        }
      } else {
        updateData.total_expense = String(totalExpense)
      }
    }
  }

  const { data: localRun, error } = await supabase
    .from('local_runs')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateLocalRunStatus') }
  }

  revalidatePath('/local-runs')
  return { success: true, data: localRun }
}

export async function addDriveToRun(localRunId: string, localDriveId: string) {
  const auth = await authorize('local_runs.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('local_drives')
    .update({ local_run_id: localRunId })
    .eq('id', localDriveId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'addDriveToRun') }
  }

  revalidatePath('/local-runs')
  revalidatePath('/local-drives')
  return { success: true }
}

export async function removeDriveFromRun(localDriveId: string) {
  const auth = await authorize('local_runs.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('local_drives')
    .update({ local_run_id: null })
    .eq('id', localDriveId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'removeDriveFromRun') }
  }

  revalidatePath('/local-runs')
  revalidatePath('/local-drives')
  return { success: true }
}
