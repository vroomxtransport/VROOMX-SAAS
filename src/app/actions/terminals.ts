'use server'

import { authorize, safeError } from '@/lib/authz'
import { terminalSchema } from '@/lib/validations/terminal'
import { revalidatePath } from 'next/cache'

export async function createTerminal(data: unknown) {
  const parsed = terminalSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('terminals.create', { rateLimit: { key: 'createTerminal', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: terminal, error } = await supabase
    .from('terminals')
    .insert({
      tenant_id: tenantId,
      name: v.name,
      address: v.address || null,
      city: v.city || null,
      state: v.state || null,
      zip: v.zip || null,
      latitude: typeof v.latitude === 'number' ? v.latitude : null,
      longitude: typeof v.longitude === 'number' ? v.longitude : null,
      service_radius_miles: v.serviceRadiusMiles,
      is_active: v.isActive,
      auto_create_local_drives: v.autoCreateLocalDrives,
      auto_create_states: v.autoCreateStates && v.autoCreateStates.length > 0 ? v.autoCreateStates : null,
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createTerminal') }
  }

  revalidatePath('/settings/terminals')
  return { success: true, data: terminal }
}

export async function updateTerminal(id: string, data: unknown) {
  const parsed = terminalSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('terminals.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  const { data: terminal, error } = await supabase
    .from('terminals')
    .update({
      name: v.name,
      address: v.address || null,
      city: v.city || null,
      state: v.state || null,
      zip: v.zip || null,
      latitude: typeof v.latitude === 'number' ? v.latitude : null,
      longitude: typeof v.longitude === 'number' ? v.longitude : null,
      service_radius_miles: v.serviceRadiusMiles,
      is_active: v.isActive,
      auto_create_local_drives: v.autoCreateLocalDrives,
      auto_create_states: v.autoCreateStates && v.autoCreateStates.length > 0 ? v.autoCreateStates : null,
      notes: v.notes || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTerminal') }
  }

  revalidatePath('/settings/terminals')
  return { success: true, data: terminal }
}

export async function deleteTerminal(id: string) {
  const auth = await authorize('terminals.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('terminals')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTerminal') }
  }

  revalidatePath('/settings/terminals')
  return { success: true }
}
