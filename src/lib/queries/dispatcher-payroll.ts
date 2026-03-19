import type { SupabaseClient } from '@supabase/supabase-js'
import type { DispatcherPayConfig, DispatcherPayrollPeriod } from '@/types/database'

// ============================================================================
// Pay Config Queries
// ============================================================================

export interface PayConfigFilters {
  userId?: string
  activeOnly?: boolean
}

export async function fetchDispatcherPayConfigs(
  supabase: SupabaseClient,
  filters: PayConfigFilters = {},
): Promise<DispatcherPayConfig[]> {
  let query = supabase
    .from('dispatcher_pay_configs')
    .select('*')
    .order('effective_from', { ascending: false })

  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }

  if (filters.activeOnly) {
    query = query.is('effective_to', null)
  }

  const { data, error } = await query

  if (error) throw error
  return data ?? []
}

export async function fetchActivePayConfig(
  supabase: SupabaseClient,
  userId: string,
): Promise<DispatcherPayConfig | null> {
  const { data, error } = await supabase
    .from('dispatcher_pay_configs')
    .select('*')
    .eq('user_id', userId)
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

// ============================================================================
// Payroll Period Queries
// ============================================================================

export interface PayrollPeriodFilters {
  userId?: string
  status?: string
  page?: number
  pageSize?: number
}

export interface PayrollPeriodsResult {
  periods: DispatcherPayrollPeriod[]
  total: number
}

export async function fetchPayrollPeriods(
  supabase: SupabaseClient,
  filters: PayrollPeriodFilters = {},
): Promise<PayrollPeriodsResult> {
  const { page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('dispatcher_payroll_periods')
    .select('*', { count: 'exact' })
    .order('period_start', { ascending: false })

  if (filters.userId) {
    query = query.eq('user_id', filters.userId)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await query

  if (error) throw error
  return { periods: data ?? [], total: count ?? 0 }
}

export async function fetchPayrollPeriodOrders(
  supabase: SupabaseClient,
  userId: string,
  periodStart: string,
  periodEnd: string,
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, revenue, broker_fee, local_fee, status, created_at')
    .eq('dispatched_by', userId)
    .gte('created_at', `${periodStart}T00:00:00Z`)
    .lte('created_at', `${periodEnd}T23:59:59Z`)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

// ============================================================================
// Dispatcher List with Pay Config (for payroll page)
// ============================================================================

export interface DispatcherWithPayConfig {
  user_id: string
  full_name: string
  email: string
  role: string
  pay_config: DispatcherPayConfig | null
}

export async function fetchDispatchersWithPayConfig(
  supabase: SupabaseClient,
): Promise<DispatcherWithPayConfig[]> {
  // Fetch all dispatchers (team members)
  const { data: members, error: membersError } = await supabase
    .from('tenant_memberships')
    .select('*')
    .in('role', ['owner', 'admin', 'dispatcher'])
    .order('created_at', { ascending: true })

  if (membersError) throw membersError

  // Fetch all active pay configs
  const { data: configs, error: configsError } = await supabase
    .from('dispatcher_pay_configs')
    .select('*')
    .is('effective_to', null)

  if (configsError) throw configsError

  const configMap = new Map<string, DispatcherPayConfig>()
  for (const c of configs ?? []) {
    configMap.set(c.user_id, c)
  }

  return (members ?? []).map((m: Record<string, unknown>) => ({
    user_id: m.user_id as string,
    full_name: (m.full_name as string) || '',
    email: (m.email as string) || '',
    role: m.role as string,
    pay_config: configMap.get(m.user_id as string) ?? null,
  }))
}
