'use server'

import { createClient } from '@/lib/supabase/server'
import { isAccountSuspended } from '@/lib/tier'
import { hasPermission, getBuiltInRolePermissions } from '@/lib/permissions'
import { rateLimit, type RateLimitConfig } from '@/lib/rate-limit'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuthzContext {
  supabase: SupabaseClient
  user: { id: string; email?: string }
  tenantId: string
  role: string
  permissions: string[]
}

export type AuthzResult =
  | { ok: true; ctx: AuthzContext }
  | { ok: false; error: string }

/**
 * Authenticate user, extract tenant context, enforce permissions + suspension.
 *
 * @param requiredPermission - Permission needed (e.g. 'orders.create'). Pass '*' to just require auth.
 * @param opts.checkSuspension - Whether to enforce suspension check (default: true)
 * @param opts.rateLimit - Optional rate limit config (applied per-user + action key)
 */
export async function authorize(
  requiredPermission: string = '*',
  opts: { checkSuspension?: boolean; rateLimit?: { key: string } & RateLimitConfig } = {}
): Promise<AuthzResult> {
  const { checkSuspension = true } = opts

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { ok: false, error: 'No tenant found' }
  }

  // Rate limit check (applied per-user + action key)
  if (opts.rateLimit) {
    const { key, limit, windowMs } = opts.rateLimit
    const rl = rateLimit(`${user.id}:${key}`, { limit, windowMs })
    if (!rl.allowed) {
      return { ok: false, error: 'Too many requests. Please try again shortly.' }
    }
  }

  const role: string = user.app_metadata?.role ?? ''

  // Resolve permissions
  let permissions = getBuiltInRolePermissions(role)

  // Custom role: fetch from DB
  if (permissions === null && role.startsWith('custom:')) {
    const customRoleId = role.slice(7) // Remove 'custom:' prefix
    const { data: customRole } = await supabase
      .from('custom_roles')
      .select('permissions')
      .eq('id', customRoleId)
      .eq('tenant_id', tenantId)
      .single()

    permissions = Array.isArray(customRole?.permissions) ? customRole.permissions : []
  }

  // Fallback: no permissions if role is unknown
  if (!permissions) {
    permissions = []
  }

  // Permission check (skip if only auth is required)
  if (requiredPermission !== '*' && !hasPermission(permissions, requiredPermission)) {
    return { ok: false, error: 'Insufficient permissions' }
  }

  // Suspension check
  if (checkSuspension) {
    const { suspended } = await isAccountSuspended(supabase, tenantId)
    if (suspended) {
      return { ok: false, error: 'Account suspended. Please update your payment method.' }
    }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      user: { id: user.id, email: user.email },
      tenantId,
      role,
      permissions,
    },
  }
}

/**
 * Wrap a Supabase error into a generic message.
 * Logs the real error server-side but returns a safe string to the client.
 */
export function safeError(error: { message: string }, context?: string): string {
  console.error(`[${context ?? 'ACTION'}]`, error.message)
  return 'An unexpected error occurred. Please try again.'
}
