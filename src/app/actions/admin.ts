'use server'

import { authorizeAdmin, type AdminAuthContext } from '@/lib/admin-auth'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { TIER_PRICING, type SubscriptionPlan } from '@/types'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log an admin action to the platform_audit_logs table. */
async function logAdminAction(
  supabase: AdminAuthContext['supabase'],
  actorEmail: string,
  action: string,
  targetTenantId: string | null,
  description: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from('platform_audit_logs').insert({
    actor_email: actorEmail,
    action,
    target_tenant_id: targetTenantId,
    description,
    metadata: metadata ?? null,
  })
}

// ---------------------------------------------------------------------------
// fetchPlatformStats — Dashboard KPIs
// ---------------------------------------------------------------------------

export async function fetchPlatformStats() {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const rl = await rateLimit(`${user.id}:adminStats`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  // Parallel queries for dashboard stats
  const [
    tenantsRes,
    activeSubsRes,
    atRiskRes,
    lastMonthRes,
    recentActivityRes,
    planDistRes,
    topTenantsRes,
  ] = await Promise.all([
    // Total tenant count
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true }),

    // Active subscriptions (trialing + active)
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .in('subscription_status', ['trialing', 'active']),

    // At-risk tenants (past_due or suspended)
    supabase
      .from('tenants')
      .select('id, name, slug, plan, subscription_status, is_suspended, grace_period_ends_at')
      .or('subscription_status.eq.past_due,is_suspended.eq.true'),

    // Tenants created last 30 days (for signup trend)
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

    // Recent platform audit logs (last 20)
    supabase
      .from('platform_audit_logs')
      .select('id, actor_email, action, target_tenant_id, description, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(20),

    // Plan distribution — fetch all tenants with plan + status
    supabase
      .from('tenants')
      .select('plan, subscription_status'),

    // Top 5 tenants by order count
    supabase
      .from('tenants')
      .select('id, name, slug, plan'),
  ])

  const totalTenants = tenantsRes.count ?? 0
  const activeSubscriptions = activeSubsRes.count ?? 0
  const atRisk = atRiskRes.data ?? []
  const signupTrend = lastMonthRes.count ?? 0
  const recentActivity = recentActivityRes.data ?? []

  // Calculate plan distribution and MRR
  const allTenants = planDistRes.data ?? []
  const planDistribution: Record<string, { total: number; active: number }> = {}
  let mrr = 0

  for (const t of allTenants) {
    const plan = t.plan as string
    if (!planDistribution[plan]) {
      planDistribution[plan] = { total: 0, active: 0 }
    }
    planDistribution[plan].total++

    const isActive = t.subscription_status === 'active' || t.subscription_status === 'trialing'
    if (isActive) {
      planDistribution[plan].active++
      const price = TIER_PRICING[plan as SubscriptionPlan] ?? 0
      mrr += price
    }
  }

  // Top tenants by order count — need a separate count query per tenant
  // For efficiency, query orders grouped approach using RPC or just get counts
  const topTenantsList = topTenantsRes.data ?? []
  const topTenants: Array<{ id: string; name: string; slug: string; plan: string; orderCount: number }> = []

  if (topTenantsList.length > 0) {
    // Get order counts per tenant
    const orderCountsRes = await supabase
      .from('orders')
      .select('tenant_id')

    const ordersByTenant = new Map<string, number>()
    for (const o of orderCountsRes.data ?? []) {
      ordersByTenant.set(o.tenant_id, (ordersByTenant.get(o.tenant_id) ?? 0) + 1)
    }

    const tenantMap = new Map(topTenantsList.map((t) => [t.id, t]))
    const sorted = [...ordersByTenant.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    for (const [tenantId, count] of sorted) {
      const t = tenantMap.get(tenantId)
      if (t) {
        topTenants.push({
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          orderCount: count,
        })
      }
    }
  }

  return {
    success: true as const,
    data: {
      totalTenants,
      activeSubscriptions,
      atRisk,
      mrr,
      recentActivity,
      planDistribution,
      topTenants,
      signupTrend,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchTenants — Paginated tenant list with filters
// ---------------------------------------------------------------------------

const fetchTenantsSchema = z.object({
  search: z.string().optional(),
  // Plan filter: whitelist the known tier values. Rejects typos at the Zod
  // boundary instead of letting them hit the DB .eq() and silently return 0 rows.
  plan: z.enum(['owner_operator', 'starter_x', 'pro_x']).optional(),
  status: z.string().optional(),
  sortBy: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(25),
})

export async function fetchTenants(filters: z.input<typeof fetchTenantsSchema>) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const rl = await rateLimit(`${user.id}:adminTenants`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  const parsed = fetchTenantsSchema.safeParse(filters)
  if (!parsed.success) return { error: 'Invalid filters' }

  const { search, plan, status, sortBy, sortDir, page, pageSize } = parsed.data
  const offset = (page - 1) * pageSize

  // Build query
  let query = supabase
    .from('tenants')
    .select('*', { count: 'exact' })

  // Filters
  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `name.ilike.%${s}%,slug.ilike.%${s}%,dot_number.ilike.%${s}%`
      )
    }
  }
  if (plan) {
    query = query.eq('plan', plan)
  }
  if (status === 'suspended') {
    query = query.eq('is_suspended', true)
  } else if (status) {
    query = query.eq('subscription_status', status)
  }

  // Sort + paginate
  query = query
    .order(sortBy!, { ascending: sortDir === 'asc' })
    .range(offset, offset + pageSize - 1)

  const { data: tenants, count, error } = await query

  if (error) {
    console.error('[ADMIN] fetchTenants error:', error.message)
    return { error: 'Failed to fetch tenants' }
  }

  // Get user counts and truck counts per tenant in parallel
  const tenantIds = (tenants ?? []).map((t) => t.id)

  let userCounts = new Map<string, number>()
  let truckCounts = new Map<string, number>()

  if (tenantIds.length > 0) {
    const [membershipsRes, trucksRes] = await Promise.all([
      supabase
        .from('tenant_memberships')
        .select('tenant_id')
        .in('tenant_id', tenantIds),
      supabase
        .from('trucks')
        .select('tenant_id')
        .in('tenant_id', tenantIds),
    ])

    for (const m of membershipsRes.data ?? []) {
      userCounts.set(m.tenant_id, (userCounts.get(m.tenant_id) ?? 0) + 1)
    }
    for (const t of trucksRes.data ?? []) {
      truckCounts.set(t.tenant_id, (truckCounts.get(t.tenant_id) ?? 0) + 1)
    }
  }

  const enrichedTenants = (tenants ?? []).map((t) => ({
    ...t,
    userCount: userCounts.get(t.id) ?? 0,
    truckCount: truckCounts.get(t.id) ?? 0,
  }))

  return {
    success: true as const,
    data: {
      tenants: enrichedTenants,
      total: count ?? 0,
      page,
      pageSize,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchTenantDetail — Single tenant with related data
// ---------------------------------------------------------------------------

const tenantIdSchema = z.string().uuid('Invalid tenant ID')

export async function fetchTenantDetail(tenantId: string) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const rl = await rateLimit(`${user.id}:adminDetail`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  const idParsed = tenantIdSchema.safeParse(tenantId)
  if (!idParsed.success) return { error: 'Invalid tenant ID' }

  const [tenantRes, membersRes, orderCountRes, tripCountRes, driverCountRes, truckCountRes, auditRes, revenueMtdRes] =
    await Promise.all([
      // 1. Full tenant record
      supabase.from('tenants').select('*').eq('id', tenantId).single(),

      // 2. Team members
      supabase
        .from('tenant_memberships')
        .select('id, user_id, role, name, email, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),

      // 3. Entity counts
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),

      supabase
        .from('trips')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),

      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),

      supabase
        .from('trucks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),

      // 4. Recent audit logs for this tenant (last 50)
      supabase
        .from('audit_logs')
        .select('id, entity_type, entity_id, action, description, actor_email, metadata, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50),

      // 5. Revenue MTD from orders
      (() => {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        return supabase
          .from('orders')
          .select('revenue')
          .eq('tenant_id', tenantId)
          .gte('created_at', startOfMonth)
      })(),
    ])

  if (tenantRes.error || !tenantRes.data) {
    return { error: 'Tenant not found' }
  }

  // Sum revenue MTD
  const revenueMtd = (revenueMtdRes.data ?? []).reduce(
    (sum, o) => sum + parseFloat(o.revenue ?? '0'),
    0
  )

  return {
    success: true as const,
    data: {
      tenant: tenantRes.data,
      members: membersRes.data ?? [],
      entityCounts: {
        orders: orderCountRes.count ?? 0,
        trips: tripCountRes.count ?? 0,
        drivers: driverCountRes.count ?? 0,
        trucks: truckCountRes.count ?? 0,
      },
      auditLogs: auditRes.data ?? [],
      revenueMtd,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchAuditLogs — Cross-tenant audit log with filters
// ---------------------------------------------------------------------------

const fetchAuditLogsSchema = z.object({
  search: z.string().optional(),
  entityType: z.string().optional(),
  action: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(50),
})

export async function fetchAuditLogs(filters: z.input<typeof fetchAuditLogsSchema>) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const rl = await rateLimit(`${user.id}:adminAudit`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  const parsed = fetchAuditLogsSchema.safeParse(filters)
  if (!parsed.success) return { error: 'Invalid filters' }

  const { search, entityType, action, tenantId, startDate, endDate, page, pageSize } = parsed.data
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_logs')
    .select('id, tenant_id, entity_type, entity_id, action, description, actor_id, actor_email, metadata, created_at', { count: 'exact' })

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (entityType) query = query.eq('entity_type', entityType)
  if (action) query = query.eq('action', action)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)
  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`description.ilike.%${s}%,actor_email.ilike.%${s}%`)
    }
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('[ADMIN] fetchAuditLogs error:', error.message)
    return { error: 'Failed to fetch audit logs' }
  }

  // Enrich with tenant names
  const tenantIds = [...new Set((data ?? []).map((l) => l.tenant_id).filter(Boolean))]
  let tenantNames = new Map<string, string>()

  if (tenantIds.length > 0) {
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, name')
      .in('id', tenantIds)

    for (const t of tenants ?? []) {
      tenantNames.set(t.id, t.name)
    }
  }

  const enrichedLogs = (data ?? []).map((log) => ({
    ...log,
    tenantName: tenantNames.get(log.tenant_id) ?? null,
  }))

  return {
    success: true as const,
    data: {
      logs: enrichedLogs,
      total: count ?? 0,
      page,
      pageSize,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchSubscriptionMetrics — MRR, churn, plan distribution
// ---------------------------------------------------------------------------

export async function fetchSubscriptionMetrics() {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const rl = await rateLimit(`${user.id}:adminMetrics`, { limit: 30, windowMs: 60_000 })
  if (!rl.allowed) return { error: 'Too many requests. Please try again shortly.' }

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, slug, plan, subscription_status, is_suspended, grace_period_ends_at, trial_ends_at, created_at')

  if (error) {
    console.error('[ADMIN] fetchSubscriptionMetrics error:', error.message)
    return { error: 'Failed to fetch subscription metrics' }
  }

  const allTenants = tenants ?? []

  // Plan distribution
  const planDistribution: Record<string, { total: number; active: number; trialing: number; pastDue: number; canceled: number }> = {}
  // Status breakdown
  const statusBreakdown: Record<string, number> = {}
  // MRR calculation
  let mrr = 0
  // At-risk list
  const atRisk: Array<{ id: string; name: string; slug: string; plan: string; reason: string; gracePeriodEndsAt: string | null }> = []

  for (const t of allTenants) {
    const plan = t.plan as string
    const status = t.subscription_status as string

    // Plan distribution
    if (!planDistribution[plan]) {
      planDistribution[plan] = { total: 0, active: 0, trialing: 0, pastDue: 0, canceled: 0 }
    }
    planDistribution[plan].total++
    if (status === 'active') planDistribution[plan].active++
    if (status === 'trialing') planDistribution[plan].trialing++
    if (status === 'past_due') planDistribution[plan].pastDue++
    if (status === 'canceled') planDistribution[plan].canceled++

    // Status breakdown
    statusBreakdown[status] = (statusBreakdown[status] ?? 0) + 1

    // MRR: count active + trialing
    if (status === 'active' || status === 'trialing') {
      mrr += TIER_PRICING[plan as SubscriptionPlan] ?? 0
    }

    // At-risk detection
    if (status === 'past_due') {
      atRisk.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan,
        reason: 'past_due',
        gracePeriodEndsAt: t.grace_period_ends_at,
      })
    } else if (t.is_suspended) {
      atRisk.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan,
        reason: 'suspended',
        gracePeriodEndsAt: t.grace_period_ends_at,
      })
    }
  }

  return {
    success: true as const,
    data: {
      mrr,
      planDistribution,
      statusBreakdown,
      atRisk,
      totalTenants: allTenants.length,
    },
  }
}

// ---------------------------------------------------------------------------
// suspendTenant — Set is_suspended flag
// ---------------------------------------------------------------------------

const suspendSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  reason: z.string().min(1, 'Reason is required').max(500),
})

export async function suspendTenant(tenantId: string, reason: string) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const parsed = suspendSchema.safeParse({ tenantId, reason })
  if (!parsed.success) return { error: 'Invalid input' }

  // Rate limit: 10 suspensions per 5 min per admin
  const rl = await rateLimit(`admin:suspend:${user.email}`, { limit: 10, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) return { error: 'Rate limit exceeded. Try again later.' }

  const { error } = await supabase
    .from('tenants')
    .update({ is_suspended: true, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    console.error('[ADMIN] suspendTenant error:', error.message)
    return { error: 'Failed to suspend tenant' }
  }

  await logAdminAction(supabase, user.email, 'tenant.suspended', tenantId, `Suspended tenant: ${reason}`, { reason })

  return { success: true as const }
}

// ---------------------------------------------------------------------------
// unsuspendTenant — Clear suspension
// ---------------------------------------------------------------------------

export async function unsuspendTenant(tenantId: string) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const idParsed = tenantIdSchema.safeParse(tenantId)
  if (!idParsed.success) return { error: 'Invalid tenant ID' }

  // Rate limit
  const rl = await rateLimit(`admin:unsuspend:${user.email}`, { limit: 10, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) return { error: 'Rate limit exceeded. Try again later.' }

  const { error } = await supabase
    .from('tenants')
    .update({ is_suspended: false, updated_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    console.error('[ADMIN] unsuspendTenant error:', error.message)
    return { error: 'Failed to unsuspend tenant' }
  }

  await logAdminAction(supabase, user.email, 'tenant.unsuspended', tenantId, 'Unsuspended tenant')

  return { success: true as const }
}

// ---------------------------------------------------------------------------
// extendTrial — Push trial_ends_at forward
// ---------------------------------------------------------------------------

const extendTrialSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID'),
  days: z.coerce.number().int().min(1, 'Must be at least 1 day').max(90, 'Maximum 90 days'),
})

export async function extendTrial(tenantId: string, days: number) {
  const auth = await authorizeAdmin()
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const parsed = extendTrialSchema.safeParse({ tenantId, days })
  if (!parsed.success) return { error: 'Invalid input' }

  // Rate limit
  const rl = await rateLimit(`admin:extend-trial:${user.email}`, { limit: 10, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) return { error: 'Rate limit exceeded. Try again later.' }

  // Fetch current trial end date
  const { data: tenant, error: fetchErr } = await supabase
    .from('tenants')
    .select('trial_ends_at, subscription_status')
    .eq('id', tenantId)
    .single()

  if (fetchErr || !tenant) {
    return { error: 'Tenant not found' }
  }

  // Calculate new trial end date
  const baseDate = tenant.trial_ends_at
    ? new Date(tenant.trial_ends_at)
    : new Date()
  const newTrialEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

  const { error: updateErr } = await supabase
    .from('tenants')
    .update({
      trial_ends_at: newTrialEnd.toISOString(),
      subscription_status: 'trialing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (updateErr) {
    console.error('[ADMIN] extendTrial error:', updateErr.message)
    return { error: 'Failed to extend trial' }
  }

  await logAdminAction(
    supabase,
    user.email,
    'tenant.trial_extended',
    tenantId,
    `Extended trial by ${days} days until ${newTrialEnd.toISOString()}`,
    { days, previousTrialEnd: tenant.trial_ends_at, newTrialEnd: newTrialEnd.toISOString() }
  )

  return { success: true as const, data: { newTrialEnd: newTrialEnd.toISOString() } }
}
