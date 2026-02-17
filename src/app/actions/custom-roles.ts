'use server'

import { authorize, safeError } from '@/lib/authz'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const customRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  permissions: z.array(z.string().max(50)).min(1, 'At least one permission is required'),
})

export async function createCustomRole(data: unknown) {
  const parsed = customRoleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage', { rateLimit: { key: 'createCustomRole', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { name, description, permissions } = parsed.data

  // Validate all permissions are valid
  const invalidPerms = permissions.filter(p => !(ALL_PERMISSIONS as readonly string[]).includes(p))
  if (invalidPerms.length > 0) {
    return { error: `Invalid permissions: ${invalidPerms.join(', ')}` }
  }

  const { data: role, error } = await supabase
    .from('custom_roles')
    .insert({
      tenant_id: tenantId,
      name,
      description: description || null,
      permissions,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'A role with this name already exists' }
    }
    return { error: safeError(error, 'createCustomRole') }
  }

  revalidatePath('/settings')
  return { success: true, data: role }
}

export async function updateCustomRole(id: string, data: unknown) {
  const parsed = customRoleSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { name, description, permissions } = parsed.data

  // Validate all permissions are valid
  const invalidPerms = permissions.filter(p => !(ALL_PERMISSIONS as readonly string[]).includes(p))
  if (invalidPerms.length > 0) {
    return { error: `Invalid permissions: ${invalidPerms.join(', ')}` }
  }

  const { data: role, error } = await supabase
    .from('custom_roles')
    .update({
      name,
      description: description || null,
      permissions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'A role with this name already exists' }
    }
    return { error: safeError(error, 'updateCustomRole') }
  }

  revalidatePath('/settings')
  return { success: true, data: role }
}

export async function deleteCustomRole(id: string) {
  const auth = await authorize('settings.manage')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Check if any members are using this role
  const roleString = `custom:${id}`
  const { count } = await supabase
    .from('tenant_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('role', roleString)

  if (count && count > 0) {
    return { error: `Cannot delete this role. ${count} team member(s) are currently assigned to it. Reassign them first.` }
  }

  const { error } = await supabase
    .from('custom_roles')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteCustomRole') }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function fetchCustomRoles() {
  const auth = await authorize('settings.view', { checkSuspension: false })
  if (!auth.ok) return { error: auth.error, data: [] }
  const { supabase, tenantId } = auth.ctx

  const { data, error } = await supabase
    .from('custom_roles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  if (error) {
    return { error: safeError(error, 'fetchCustomRoles'), data: [] }
  }

  return { success: true, data: data ?? [] }
}
