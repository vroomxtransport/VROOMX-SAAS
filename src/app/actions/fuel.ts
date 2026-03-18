'use server'

import { authorize, safeError } from '@/lib/authz'
import { fuelSchema } from '@/lib/validations/fuel'
import { revalidatePath } from 'next/cache'

// ============================================================================
// Batch CSV import types (exported for use in the dialog)
// ============================================================================

export interface CsvFuelRow {
  date?: string
  truck?: string
  driver?: string
  gallons?: string | number
  cost_per_gallon?: string | number
  odometer?: string | number
  location?: string
  state?: string
  notes?: string
}

export interface FuelBatchResult {
  created: number
  errors: { row: number; message: string }[]
}

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

// ============================================================================
// Batch CSV import
// ============================================================================

export async function batchCreateFuelEntries(
  rows: CsvFuelRow[],
  truckMap: Record<string, string>,
  driverMap: Record<string, string>,
): Promise<FuelBatchResult> {
  const auth = await authorize('fuel.create', {
    rateLimit: { key: 'batchFuel', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { created: 0, errors: [{ row: 0, message: auth.error }] }
  const { supabase, tenantId } = auth.ctx

  if (rows.length > 500) {
    return { created: 0, errors: [{ row: 0, message: 'Maximum 500 rows per import' }] }
  }

  const result: FuelBatchResult = { created: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    // Validate required fields
    if (!r.date?.trim()) {
      result.errors.push({ row: i + 1, message: 'Date is required' })
      continue
    }
    if (!r.truck?.trim()) {
      result.errors.push({ row: i + 1, message: 'Truck is required' })
      continue
    }

    const gallons = Number(r.gallons)
    const costPerGallon = Number(r.cost_per_gallon)

    if (!gallons || gallons <= 0) {
      result.errors.push({ row: i + 1, message: 'Gallons must be greater than 0' })
      continue
    }
    if (!costPerGallon || costPerGallon <= 0) {
      result.errors.push({ row: i + 1, message: 'Cost per gallon must be greater than 0' })
      continue
    }

    // Resolve truck — server re-validates even though client already checked
    const truckKey = r.truck.trim().toLowerCase()
    const truckId = truckMap[truckKey]
    if (!truckId) {
      result.errors.push({ row: i + 1, message: `Truck "${r.truck}" not found` })
      continue
    }

    // Resolve driver (optional — skip assignment if not found, don't fail)
    let driverId: string | null = null
    if (r.driver?.trim()) {
      const driverKey = r.driver.trim().toLowerCase()
      driverId = driverMap[driverKey] ?? null
    }

    // Validate state
    const state = r.state?.trim().toUpperCase() || null
    if (state && state.length !== 2) {
      result.errors.push({ row: i + 1, message: 'State must be a 2-letter code' })
      continue
    }

    const totalCost = gallons * costPerGallon
    const odometer = r.odometer ? Number(r.odometer) : null

    const { error } = await supabase.from('fuel_entries').insert({
      tenant_id: tenantId,
      truck_id: truckId,
      driver_id: driverId,
      date: r.date.trim(),
      gallons: String(gallons),
      cost_per_gallon: String(costPerGallon),
      total_cost: String(totalCost),
      odometer: odometer && odometer > 0 ? odometer : null,
      location: r.location?.trim() || null,
      state,
      notes: r.notes?.trim() || null,
    })

    if (error) {
      safeError(error, `batchCreateFuelEntries row ${i + 1}`)
      result.errors.push({ row: i + 1, message: 'Failed to create fuel entry' })
    } else {
      result.created++
    }
  }

  revalidatePath('/fuel-tracking')
  return result
}
