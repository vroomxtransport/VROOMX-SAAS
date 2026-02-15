'use server'

import { createClient } from '@/lib/supabase/server'
import { truckSchema } from '@/lib/validations/truck'
import { checkTierLimit } from '@/lib/tier'
import { revalidatePath } from 'next/cache'

export async function createTruck(data: unknown) {
  const parsed = truckSchema.safeParse(data)
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

  // Tier limit check: block if truck limit reached or account suspended
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
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: truck }
}

export async function updateTruck(id: string, data: unknown) {
  const parsed = truckSchema.safeParse(data)
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
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: truck }
}

export async function deleteTruck(id: string) {
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
    .from('trucks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { success: true }
}

export async function updateTruckStatus(
  id: string,
  status: 'active' | 'inactive' | 'maintenance'
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

  const { data: truck, error } = await supabase
    .from('trucks')
    .update({ truck_status: status })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: truck }
}
