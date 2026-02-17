'use server'

import { authorize, safeError } from '@/lib/authz'
import { fuelSchema } from '@/lib/validations/fuel'
import { revalidatePath } from 'next/cache'

export async function createFuelEntry(data: unknown) {
  const parsed = fuelSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('fuel.create', { rateLimit: { key: 'createFuelEntry', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'createFuelEntry') }
  }

  revalidatePath('/fuel-tracking')
  return { success: true, data: entry }
}

export async function updateFuelEntry(id: string, data: unknown) {
  const parsed = fuelSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('fuel.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'updateFuelEntry') }
  }

  revalidatePath('/fuel-tracking')
  return { success: true, data: entry }
}

export async function deleteFuelEntry(id: string) {
  const auth = await authorize('fuel.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('fuel_entries')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteFuelEntry') }
  }

  revalidatePath('/fuel-tracking')
  return { success: true }
}
