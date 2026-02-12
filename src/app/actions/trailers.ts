'use server'

import { createClient } from '@/lib/supabase/server'
import { trailerSchema } from '@/lib/validations/trailer'
import { revalidatePath } from 'next/cache'

export async function createTrailer(data: unknown) {
  const parsed = trailerSchema.safeParse(data)
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

  const { data: trailer, error } = await supabase
    .from('trailers')
    .insert({
      tenant_id: tenantId,
      trailer_number: parsed.data.trailerNumber,
      trailer_type: parsed.data.trailerType,
      status: parsed.data.status,
      year: parsed.data.year || null,
      make: parsed.data.make || null,
      model: parsed.data.model || null,
      vin: parsed.data.vin || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: trailer }
}

export async function updateTrailer(id: string, data: unknown) {
  const parsed = trailerSchema.safeParse(data)
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

  const { data: trailer, error } = await supabase
    .from('trailers')
    .update({
      trailer_number: parsed.data.trailerNumber,
      trailer_type: parsed.data.trailerType,
      status: parsed.data.status,
      year: parsed.data.year || null,
      make: parsed.data.make || null,
      model: parsed.data.model || null,
      vin: parsed.data.vin || null,
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
  return { data: trailer }
}

export async function deleteTrailer(id: string) {
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
    .from('trailers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { success: true }
}

export async function assignTrailerToTruck(truckId: string, trailerId: string) {
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
    .update({ trailer_id: trailerId })
    .eq('id', truckId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: truck }
}

export async function unassignTrailerFromTruck(truckId: string) {
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
    .update({ trailer_id: null })
    .eq('id', truckId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/trucks')
  return { data: truck }
}
