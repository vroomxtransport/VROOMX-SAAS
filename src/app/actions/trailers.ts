'use server'

import { authorize, safeError } from '@/lib/authz'
import { trailerSchema } from '@/lib/validations/trailer'
import { revalidatePath } from 'next/cache'

export async function createTrailer(data: unknown) {
  const parsed = trailerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trailers.create', { rateLimit: { key: 'createTrailer', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'createTrailer') }
  }

  revalidatePath('/trailers')
  return { success: true, data: trailer }
}

export async function updateTrailer(id: string, data: unknown) {
  const parsed = trailerSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trailers.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'updateTrailer') }
  }

  revalidatePath('/trailers')
  return { success: true, data: trailer }
}

export async function deleteTrailer(id: string) {
  const auth = await authorize('trailers.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('trailers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTrailer') }
  }

  revalidatePath('/trailers')
  return { success: true }
}

export async function assignTrailerToTruck(truckId: string, trailerId: string) {
  const auth = await authorize('trailers.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: truck, error } = await supabase
    .from('trucks')
    .update({ trailer_id: trailerId })
    .eq('id', truckId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'assignTrailerToTruck') }
  }

  revalidatePath('/trailers')
  return { success: true, data: truck }
}

export async function unassignTrailerFromTruck(truckId: string) {
  const auth = await authorize('trailers.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: truck, error } = await supabase
    .from('trucks')
    .update({ trailer_id: null })
    .eq('id', truckId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'unassignTrailerFromTruck') }
  }

  revalidatePath('/trailers')
  return { success: true, data: truck }
}
