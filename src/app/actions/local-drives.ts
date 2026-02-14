'use server'

import { createClient } from '@/lib/supabase/server'
import { localDriveSchema } from '@/lib/validations/local-drive'
import { revalidatePath } from 'next/cache'

export async function createLocalDrive(data: unknown) {
  const parsed = localDriveSchema.safeParse(data)
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

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .insert({
      tenant_id: tenantId,
      driver_id: parsed.data.driverId || null,
      truck_id: parsed.data.truckId || null,
      pickup_location: parsed.data.pickupLocation || null,
      pickup_city: parsed.data.pickupCity || null,
      pickup_state: parsed.data.pickupState || null,
      delivery_location: parsed.data.deliveryLocation || null,
      delivery_city: parsed.data.deliveryCity || null,
      delivery_state: parsed.data.deliveryState || null,
      scheduled_date: parsed.data.scheduledDate || null,
      revenue: String(parsed.data.revenue),
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/local-drives')
  return { data: localDrive }
}

export async function updateLocalDrive(id: string, data: unknown) {
  const parsed = localDriveSchema.safeParse(data)
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

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .update({
      driver_id: parsed.data.driverId || null,
      truck_id: parsed.data.truckId || null,
      pickup_location: parsed.data.pickupLocation || null,
      pickup_city: parsed.data.pickupCity || null,
      pickup_state: parsed.data.pickupState || null,
      delivery_location: parsed.data.deliveryLocation || null,
      delivery_city: parsed.data.deliveryCity || null,
      delivery_state: parsed.data.deliveryState || null,
      scheduled_date: parsed.data.scheduledDate || null,
      revenue: String(parsed.data.revenue),
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/local-drives')
  return { data: localDrive }
}

export async function deleteLocalDrive(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('local_drives').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/local-drives')
  return { success: true }
}

export async function updateLocalDriveStatus(id: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const updateData: Record<string, string> = { status }
  if (status === 'completed') {
    updateData.completed_date = new Date().toISOString()
  }

  const { data: localDrive, error } = await supabase
    .from('local_drives')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/local-drives')
  return { data: localDrive }
}
