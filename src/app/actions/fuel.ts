'use server'

import { createClient } from '@/lib/supabase/server'
import { fuelSchema } from '@/lib/validations/fuel'
import { revalidatePath } from 'next/cache'

export async function createFuelEntry(data: unknown) {
  const parsed = fuelSchema.safeParse(data)
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

  const totalCost = parsed.data.gallons * parsed.data.costPerGallon

  const { data: entry, error } = await supabase
    .from('fuel_entries')
    .insert({
      tenant_id: tenantId,
      truck_id: parsed.data.truckId,
      driver_id: parsed.data.driverId || null,
      date: parsed.data.date,
      gallons: String(parsed.data.gallons),
      cost_per_gallon: String(parsed.data.costPerGallon),
      total_cost: String(totalCost),
      odometer: parsed.data.odometer ?? null,
      location: parsed.data.location || null,
      state: parsed.data.state || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/fuel-tracking')
  return { data: entry }
}

export async function updateFuelEntry(id: string, data: unknown) {
  const parsed = fuelSchema.safeParse(data)
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

  const totalCost = parsed.data.gallons * parsed.data.costPerGallon

  const { data: entry, error } = await supabase
    .from('fuel_entries')
    .update({
      truck_id: parsed.data.truckId,
      driver_id: parsed.data.driverId || null,
      date: parsed.data.date,
      gallons: String(parsed.data.gallons),
      cost_per_gallon: String(parsed.data.costPerGallon),
      total_cost: String(totalCost),
      odometer: parsed.data.odometer ?? null,
      location: parsed.data.location || null,
      state: parsed.data.state || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/fuel-tracking')
  return { data: entry }
}

export async function deleteFuelEntry(id: string) {
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
    .from('fuel_entries')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/fuel-tracking')
  return { success: true }
}
