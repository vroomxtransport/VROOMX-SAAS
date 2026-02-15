'use server'

import { createClient } from '@/lib/supabase/server'
import { maintenanceSchema } from '@/lib/validations/maintenance'
import { revalidatePath } from 'next/cache'

export async function createMaintenanceRecord(data: unknown) {
  const parsed = maintenanceSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { data: record, error } = await supabase
    .from('maintenance_records')
    .insert({
      tenant_id: tenantId,
      truck_id: parsed.data.truckId,
      maintenance_type: parsed.data.maintenanceType,
      status: parsed.data.status,
      description: parsed.data.description || null,
      vendor: parsed.data.vendor || null,
      cost: String(parsed.data.cost),
      scheduled_date: parsed.data.scheduledDate || null,
      odometer: parsed.data.odometer ?? null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/maintenance')
  return { data: record }
}

export async function updateMaintenanceRecord(id: string, data: unknown) {
  const parsed = maintenanceSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { data: record, error } = await supabase
    .from('maintenance_records')
    .update({
      truck_id: parsed.data.truckId,
      maintenance_type: parsed.data.maintenanceType,
      status: parsed.data.status,
      description: parsed.data.description || null,
      vendor: parsed.data.vendor || null,
      cost: String(parsed.data.cost),
      scheduled_date: parsed.data.scheduledDate || null,
      odometer: parsed.data.odometer ?? null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/maintenance')
  return { data: record }
}

export async function deleteMaintenanceRecord(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const { error } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/maintenance')
  return { success: true }
}

export async function updateMaintenanceStatus(
  id: string,
  status: 'scheduled' | 'in_progress' | 'completed'
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  const updateData: Record<string, string> = { status }
  if (status === 'completed') {
    updateData.completed_date = new Date().toISOString()
  }

  const { data: record, error } = await supabase
    .from('maintenance_records')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/maintenance')
  return { data: record }
}
