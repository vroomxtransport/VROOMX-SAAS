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

// SCAN-006 (SEC-009): permissions that trigger a live membership lookup
// in the DB instead of trusting the JWT's app_metadata. JWTs can remain
// valid for up to an hour after a user is removed from a tenant; for
// actions that move money or change access, we want revocation to take
// effect almost immediately. Read-heavy permissions (*.view, *.list) are
// deliberately NOT in this set — paying a DB round-trip on every page
// load isn't worth the marginal security.
const SENSITIVE_PERMISSIONS = new Set<string>([
  'payments.create',
  'payments.update',
  'payments.delete',
  'invoices.send',
  'billing.manage',
  'settings.manage',
  'custom_roles.manage',
  'integrations.manage',
])

// Short TTL so revoked users lose access within ~30s but the DB isn't
// hit on every sensitive action. The cache key is per-tenant+user.
const MEMBERSHIP_CACHE_TTL_MS = 30_000
const MEMBERSHIP_CACHE_MAX_ENTRIES = 1000

type MembershipCacheEntry = { valid: boolean; expiresAt: number }
const membershipCache = new Map<string, MembershipCacheEntry>()

function membershipCacheKey(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`
}

async function verifyLiveMembership(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const key = membershipCacheKey(tenantId, userId)
  const now = Date.now()
  const cached = membershipCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.valid
  }

  // tenant_memberships has no status column — VroomX treats row presence
  // as the active/revoked signal. If the membership row is gone (cascade
  // from tenant delete, or explicit removal), the user is revoked.
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()

  const valid = !error && !!data
  membershipCache.set(key, { valid, expiresAt: now + MEMBERSHIP_CACHE_TTL_MS })

  // Bound memory: opportunistically prune expired entries when the map
  // grows past a soft cap. Keeps steady-state size bounded without a
  // background timer (serverless-friendly — no setInterval).
  if (membershipCache.size > MEMBERSHIP_CACHE_MAX_ENTRIES) {
    for (const [k, v] of membershipCache.entries()) {
      if (v.expiresAt <= now) membershipCache.delete(k)
    }
  }

  return valid
}

/**
 * Test-only: invalidate the membership cache. Used so unit tests don't
 * leak state across cases. Not exported for production code — prod
 * should rely on the TTL.
 */
export function __resetMembershipCacheForTests(): void {
  membershipCache.clear()
}

/**
 * Authenticate user, extract tenant context, enforce permissions + suspension.
 *
 * @param requiredPermission - Permission needed (e.g. 'orders.create'). Pass '*' to just require auth.
 * @param opts.checkSuspension - Whether to enforce suspension check (default: true)
 * @param opts.rateLimit - Optional rate limit config (applied per-user + action key)
 * @param opts.requireLiveMembership - Force a live tenant_memberships DB check
 *   regardless of the SENSITIVE_PERMISSIONS list. Permissions in that list
 *   already get the live check automatically (SCAN-006 / SEC-009).
 */
export async function authorize(
  requiredPermission: string = '*',
  opts: {
    checkSuspension?: boolean
    rateLimit?: { key: string } & RateLimitConfig
    requireLiveMembership?: boolean
  } = {}
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
    const rl = await rateLimit(`${user.id}:${key}`, { limit, windowMs })
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

  // SCAN-006 (SEC-009): live membership verification for sensitive
  // actions. The JWT's app_metadata is trusted up to this point, but
  // for money-moving / settings-changing actions we want an immediate
  // revocation signal. 30s cache per tenant+user keeps DB load flat.
  const needsLiveMembership =
    opts.requireLiveMembership === true ||
    SENSITIVE_PERMISSIONS.has(requiredPermission)

  if (needsLiveMembership) {
    const active = await verifyLiveMembership(supabase, tenantId, user.id)
    if (!active) {
      return { ok: false, error: 'Membership revoked or inactive. Please sign in again.' }
    }
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
