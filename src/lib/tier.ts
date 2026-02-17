import { type TenantRole, type SubscriptionPlan, TIER_LIMITS } from '@/types'

export function getTierDisplayName(plan: string): string {
  const names: Record<string, string> = {
    trial: 'Free Trial',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }
  return names[plan] || plan
}

export function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    canceled: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    unpaid: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  }
  return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400'
}

const ROLE_LEVEL: Record<string, number> = {
  viewer: 0,
  dispatcher: 1,
  admin: 2,
  owner: 3,
}

export function hasMinRole(userRole: string, requiredRole: TenantRole): boolean {
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[requiredRole] ?? 0)
}

/**
 * Check if the tenant has capacity to add more of a given resource.
 * Always reads plan from DB (not JWT) to avoid stale data.
 * Trial plans use starter-tier limits.
 */
export async function checkTierLimit(
  supabase: any,
  tenantId: string,
  resource: 'trucks' | 'users'
): Promise<{ allowed: boolean; current: number; limit: number; plan: string }> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, is_suspended')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    return { allowed: false, current: 0, limit: 0, plan: 'unknown' }
  }

  // Suspended accounts cannot create anything
  if (tenant.is_suspended) {
    return { allowed: false, current: 0, limit: 0, plan: tenant.plan }
  }

  // Map plan to tier limits. 'trial' uses starter limits.
  const plan = tenant.plan as SubscriptionPlan
  const tierKey = plan === ('trial' as any) ? 'starter' : plan
  const limits = TIER_LIMITS[tierKey as SubscriptionPlan]

  if (!limits) {
    return { allowed: false, current: 0, limit: 0, plan: tenant.plan }
  }

  const limit = limits[resource]

  // Count current resources
  const table = resource === 'trucks' ? 'trucks' : 'tenant_memberships'
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const current = count ?? 0

  return {
    allowed: limit === Infinity ? true : current < limit,
    current,
    limit: limit === Infinity ? -1 : limit, // -1 signals unlimited
    plan: tenant.plan,
  }
}

/**
 * Check if a tenant account is suspended.
 * Also handles lazy suspension when grace period has expired but is_suspended
 * hasn't been flipped yet.
 */
export async function isAccountSuspended(
  supabase: any,
  tenantId: string
): Promise<{ suspended: boolean; gracePeriodEndsAt: string | null }> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('is_suspended, grace_period_ends_at')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    return { suspended: false, gracePeriodEndsAt: null }
  }

  // Check if grace period has expired but is_suspended hasn't been set yet
  if (tenant.grace_period_ends_at && !tenant.is_suspended) {
    const graceEnd = new Date(tenant.grace_period_ends_at)
    if (graceEnd < new Date()) {
      // Grace period expired -- mark as suspended via service role
      // (restricted UPDATE RLS prevents authenticated users from changing is_suspended)
      const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
      const adminClient = createServiceRoleClient()
      await adminClient
        .from('tenants')
        .update({ is_suspended: true })
        .eq('id', tenantId)
      return { suspended: true, gracePeriodEndsAt: tenant.grace_period_ends_at }
    }
  }

  return {
    suspended: tenant.is_suspended,
    gracePeriodEndsAt: tenant.grace_period_ends_at,
  }
}
