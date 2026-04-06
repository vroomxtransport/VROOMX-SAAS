// ============================================================================
// Alert Evaluator — fetches current metric values and checks against rules
// Designed to run server-side (cron or on-demand). Pure side-effect-free
// computation; callers are responsible for persistence + notifications.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfDay, startOfWeek, format, differenceInDays } from 'date-fns'
import type { AlertOperator } from './alert-metrics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string
  tenantId: string
  userId: string
  name: string
  metric: string
  operator: AlertOperator
  threshold: string // numeric stored as string by Supabase
  notifyInApp: boolean
  notifyEmail: boolean
  emailRecipients: string[] | null
  enabled: boolean
  lastTriggeredAt: string | null
  cooldownMinutes: number
}

export interface TriggeredAlert {
  rule: AlertRule
  currentValue: number
  thresholdValue: number
}

// ---------------------------------------------------------------------------
// Operator evaluation
// ---------------------------------------------------------------------------

function evaluateOperator(
  value: number,
  operator: AlertOperator,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt': return value > threshold
    case 'lt': return value < threshold
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
  }
}

// ---------------------------------------------------------------------------
// Cooldown check — returns true if the rule is still within cooldown period
// ---------------------------------------------------------------------------

function isInCooldown(rule: AlertRule): boolean {
  if (!rule.lastTriggeredAt) return false
  const lastTriggered = new Date(rule.lastTriggeredAt).getTime()
  const cooldownMs = rule.cooldownMinutes * 60 * 1000
  return Date.now() < lastTriggered + cooldownMs
}

// ---------------------------------------------------------------------------
// Per-metric data fetchers
// ---------------------------------------------------------------------------

async function fetchDailyRevenue(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const tomorrow = format(startOfDay(new Date(Date.now() + 86_400_000)), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('orders')
    .select('revenue')
    .eq('tenant_id', tenantId)
    .gte('created_at', today)
    .lt('created_at', tomorrow)

  if (error) throw error
  return (data ?? []).reduce((sum, o) => sum + parseFloat(o.revenue ?? '0'), 0)
}

async function fetchWeeklyRevenue(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('orders')
    .select('revenue')
    .eq('tenant_id', tenantId)
    .gte('created_at', weekStart)

  if (error) throw error
  return (data ?? []).reduce((sum, o) => sum + parseFloat(o.revenue ?? '0'), 0)
}

async function fetchOperatingRatio(supabase: SupabaseClient, tenantId: string): Promise<number> {
  // MTD operating ratio: (total expenses / total revenue) * 100
  const monthStart = format(startOfDay(new Date(new Date().setDate(1))), 'yyyy-MM-dd')

  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('revenue, broker_fee, local_fee')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart)

  if (ordErr) throw ordErr

  const { data: trips, error: tripErr } = await supabase
    .from('trips')
    .select('driver_pay, total_expenses')
    .eq('tenant_id', tenantId)
    .gte('start_date', monthStart)

  if (tripErr) throw tripErr

  let revenue = 0
  let expenses = 0

  for (const o of orders ?? []) {
    revenue += parseFloat(o.revenue ?? '0')
    expenses += parseFloat(o.broker_fee ?? '0') + parseFloat(o.local_fee ?? '0')
  }

  for (const t of trips ?? []) {
    expenses += parseFloat(t.driver_pay ?? '0') + parseFloat(t.total_expenses ?? '0')
  }

  if (revenue === 0) return 0
  return (expenses / revenue) * 100
}

async function fetchNetMargin(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const monthStart = format(startOfDay(new Date(new Date().setDate(1))), 'yyyy-MM-dd')

  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('revenue, broker_fee, local_fee')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart)

  if (ordErr) throw ordErr

  const { data: trips, error: tripErr } = await supabase
    .from('trips')
    .select('driver_pay, total_expenses')
    .eq('tenant_id', tenantId)
    .gte('start_date', monthStart)

  if (tripErr) throw tripErr

  let revenue = 0
  let expenses = 0

  for (const o of orders ?? []) {
    revenue += parseFloat(o.revenue ?? '0')
    expenses += parseFloat(o.broker_fee ?? '0') + parseFloat(o.local_fee ?? '0')
  }

  for (const t of trips ?? []) {
    expenses += parseFloat(t.driver_pay ?? '0') + parseFloat(t.total_expenses ?? '0')
  }

  const netProfit = revenue - expenses
  if (revenue === 0) return 0
  return (netProfit / revenue) * 100
}

async function fetchCostPerMile(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const monthStart = format(startOfDay(new Date(new Date().setDate(1))), 'yyyy-MM-dd')

  const { data: trips, error } = await supabase
    .from('trips')
    .select('total_expenses, driver_pay, total_miles')
    .eq('tenant_id', tenantId)
    .gte('start_date', monthStart)

  if (error) throw error

  let totalCosts = 0
  let totalMiles = 0

  for (const t of trips ?? []) {
    totalCosts += parseFloat(t.total_expenses ?? '0') + parseFloat(t.driver_pay ?? '0')
    totalMiles += parseFloat(t.total_miles ?? '0')
  }

  if (totalMiles === 0) return 0
  return totalCosts / totalMiles
}

async function fetchOnTimeRate(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const monthStart = format(startOfDay(new Date(new Date().setDate(1))), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('orders')
    .select('delivery_date, actual_delivery_date, status')
    .eq('tenant_id', tenantId)
    .in('status', ['delivered', 'invoiced', 'paid'])
    .gte('delivery_date', monthStart)
    .not('delivery_date', 'is', null)
    .not('actual_delivery_date', 'is', null)

  if (error) throw error

  const orders = data ?? []
  if (orders.length === 0) return 100

  let onTime = 0
  for (const o of orders) {
    const scheduled = new Date(o.delivery_date!)
    const actual = new Date(o.actual_delivery_date!)
    scheduled.setHours(0, 0, 0, 0)
    actual.setHours(0, 0, 0, 0)
    const diff = differenceInDays(actual, scheduled)
    if (diff <= 0) onTime++
  }

  return (onTime / orders.length) * 100
}

async function fetchArAging60(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 60)
  const cutoff = cutoffDate.toISOString()

  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('payment_status', ['invoiced', 'unpaid'])
    .lte('invoice_date', cutoff)

  if (error) throw error
  return count ?? 0
}

async function fetchDriverUtilization(supabase: SupabaseClient, tenantId: string): Promise<number> {
  // Active drivers with at least one trip in the last 30 days / total active drivers * 100
  const thirtyDaysAgo = format(new Date(Date.now() - 30 * 86_400_000), 'yyyy-MM-dd')

  const { count: totalDrivers, error: dErr } = await supabase
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('driver_status', 'active')

  if (dErr) throw dErr
  if (!totalDrivers || totalDrivers === 0) return 0

  const { data: activeTrips, error: tErr } = await supabase
    .from('trips')
    .select('driver_id')
    .eq('tenant_id', tenantId)
    .gte('start_date', thirtyDaysAgo)

  if (tErr) throw tErr

  const uniqueDriverIds = new Set((activeTrips ?? []).map((t) => t.driver_id))
  return (uniqueDriverIds.size / totalDrivers) * 100
}

// ---------------------------------------------------------------------------
// Metric value dispatcher
// ---------------------------------------------------------------------------

async function fetchMetricValue(
  supabase: SupabaseClient,
  tenantId: string,
  metric: string
): Promise<number> {
  switch (metric) {
    case 'daily_revenue':      return fetchDailyRevenue(supabase, tenantId)
    case 'weekly_revenue':     return fetchWeeklyRevenue(supabase, tenantId)
    case 'operating_ratio':    return fetchOperatingRatio(supabase, tenantId)
    case 'net_margin':         return fetchNetMargin(supabase, tenantId)
    case 'cost_per_mile':      return fetchCostPerMile(supabase, tenantId)
    case 'on_time_rate':       return fetchOnTimeRate(supabase, tenantId)
    case 'ar_aging_60':        return fetchArAging60(supabase, tenantId)
    case 'driver_utilization': return fetchDriverUtilization(supabase, tenantId)
    default:
      throw new Error(`Unknown metric: ${metric}`)
  }
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate all provided alert rules against current live metric values.
 * Returns only rules that have breached their threshold AND are past cooldown.
 * Does NOT persist or send notifications — callers handle side effects.
 */
export async function evaluateAlerts(
  supabase: SupabaseClient,
  tenantId: string,
  rules: AlertRule[]
): Promise<TriggeredAlert[]> {
  const triggered: TriggeredAlert[] = []

  const enabledRules = rules.filter((r) => r.enabled && !isInCooldown(r))

  for (const rule of enabledRules) {
    try {
      const currentValue = await fetchMetricValue(supabase, tenantId, rule.metric)
      const thresholdValue = parseFloat(rule.threshold)

      if (evaluateOperator(currentValue, rule.operator, thresholdValue)) {
        triggered.push({ rule, currentValue, thresholdValue })
      }
    } catch (err) {
      // Log but don't abort — one failing metric should not block others
      console.error(`[alertEvaluator] Failed to evaluate metric "${rule.metric}" for rule ${rule.id}:`, err)
    }
  }

  return triggered
}
