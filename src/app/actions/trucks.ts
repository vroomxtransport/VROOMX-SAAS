'use server'

import { authorize, safeError } from '@/lib/authz'
import { truckSchema } from '@/lib/validations/truck'
import { checkTierLimit } from '@/lib/tier'
import { revalidatePath } from 'next/cache'

export async function createTruck(data: unknown) {
  const parsed = truckSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trucks.create', { rateLimit: { key: 'createTruck', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Tier limit check: block if truck limit reached
  const tierCheck = await checkTierLimit(supabase, tenantId, 'trucks')
  if (!tierCheck.allowed) {
    if (tierCheck.limit === 0) {
      return { error: 'Your account is suspended. Please update your payment method.' }
    }
    return { error: `Truck limit reached (${tierCheck.current}/${tierCheck.limit}). Upgrade your plan to add more trucks.` }
  }

  const { data: truck, error } = await supabase
    .from('trucks')
    .insert({
      tenant_id: tenantId,
      unit_number: parsed.data.unitNumber,
      truck_type: parsed.data.truckType,
      truck_status: parsed.data.truckStatus,
      year: parsed.data.year || null,
      make: parsed.data.make || null,
      model: parsed.data.model || null,
      vin: parsed.data.vin || null,
      ownership: parsed.data.ownership || 'company',
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createTruck') }
  }

  revalidatePath('/trucks')
  return { data: truck }
}

export async function updateTruck(id: string, data: unknown) {
  const parsed = truckSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trucks.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: truck, error } = await supabase
    .from('trucks')
    .update({
      unit_number: parsed.data.unitNumber,
      truck_type: parsed.data.truckType,
      truck_status: parsed.data.truckStatus,
      year: parsed.data.year || null,
      make: parsed.data.make || null,
      model: parsed.data.model || null,
      vin: parsed.data.vin || null,
      ownership: parsed.data.ownership || 'company',
      notes: parsed.data.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTruck') }
  }

  revalidatePath('/trucks')
  return { data: truck }
}

export async function deleteTruck(id: string) {
  const auth = await authorize('trucks.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('trucks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTruck') }
  }

  revalidatePath('/trucks')
  return { success: true }
}

export async function updateTruckStatus(
  id: string,
  status: 'active' | 'inactive' | 'maintenance'
) {
  const auth = await authorize('trucks.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: truck, error } = await supabase
    .from('trucks')
    .update({ truck_status: status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTruckStatus') }
  }

  revalidatePath('/trucks')
  return { data: truck }
}
