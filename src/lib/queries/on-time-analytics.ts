import type { SupabaseClient } from '@supabase/supabase-js'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from './financials'

// ============================================================================
// Types
// ============================================================================

export interface OTDMetrics {
  totalDelivered: number
  onTimeCount: number
  lateCount: number
  earlyCount: number
  onTimeRate: number // percentage 0-100
  avgDaysVariance: number // negative = early, positive = late
}

export interface OTDByDriver {
  driverId: string
  driverName: string
  totalDelivered: number
  onTimeCount: number
  onTimeRate: number
  avgDaysVariance: number
}

export interface OTDByBroker {
  brokerId: string
  brokerName: string
  totalDelivered: number
  onTimeCount: number
  onTimeRate: number
  avgDaysVariance: number
}

export interface OTDTrend {
  month: string
  onTimeRate: number
  totalDelivered: number
  lateCount: number
}

// ============================================================================
// Internal helpers
// ============================================================================

type DeliveredStatus = 'delivered' | 'invoiced' | 'paid'

const DELIVERED_STATUSES: DeliveredStatus[] = ['delivered', 'invoiced', 'paid']

interface RawOrder {
  id: string
  delivery_date: string | null
  updated_at: string
  status: string
  driver_id: string | null
  broker_id: string | null
  driver: unknown
  broker: unknown
}

/**
 * Compute days variance for a single order.
 * Positive = late, negative = early.
 * Returns null if delivery_date is missing (cannot compute OTD).
 */
function computeDaysVariance(order: RawOrder): number | null {
  if (!order.delivery_date) return null

  const scheduled = new Date(order.delivery_date)
  const actual = new Date(order.updated_at)

  // Strip time component — OTD is date-level granularity
  scheduled.setHours(0, 0, 0, 0)
  actual.setHours(0, 0, 0, 0)

  const diffMs = actual.getTime() - scheduled.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return Math.round(diffDays * 100) / 100
}

function isDeliveredStatus(status: string): boolean {
  return (DELIVERED_STATUSES as string[]).includes(status)
}

function resolveDriver(raw: unknown): { id: string; first_name: string; last_name: string } | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const first = (raw as unknown[])[0]
    return first ? (first as { id: string; first_name: string; last_name: string }) : null
  }
  return raw as { id: string; first_name: string; last_name: string }
}

function resolveBroker(raw: unknown): { id: string; name: string } | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const first = (raw as unknown[])[0]
    return first ? (first as { id: string; name: string }) : null
  }
  return raw as { id: string; name: string }
}

// ============================================================================
// Query: OTD Metrics (summary)
// ============================================================================

/**
 * Fetch overall OTD metrics for the given date range.
 * Only considers orders that have reached delivered/invoiced/paid status.
 * Delivery date (scheduled) is compared to updated_at (proxy for actual delivery).
 */
export async function fetchOTDMetrics(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<OTDMetrics> {
  const { startDate: periodStart, endDate: periodEnd } = getDateBounds(dateRange)
  const startDate = format(periodStart, 'yyyy-MM-dd')
  const endDate = format(periodEnd, 'yyyy-MM-dd')

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, updated_at, status')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .in('status', DELIVERED_STATUSES)

  if (error) throw error

  let totalDelivered = 0
  let onTimeCount = 0
  let lateCount = 0
  let earlyCount = 0
  let totalVariance = 0
  let varianceCount = 0

  for (const order of orders ?? []) {
    if (!isDeliveredStatus(order.status as string)) continue
    totalDelivered++

    const variance = computeDaysVariance(order as RawOrder)
    if (variance === null) continue

    totalVariance += variance
    varianceCount++

    if (variance <= 0) {
      onTimeCount++ // on-time = delivered on or before scheduled date
      if (variance < 0) earlyCount++
    } else {
      lateCount++
    }
  }

  const onTimeRate = totalDelivered > 0
    ? Math.round((onTimeCount / totalDelivered) * 10000) / 100
    : 0

  const avgDaysVariance = varianceCount > 0
    ? Math.round((totalVariance / varianceCount) * 100) / 100
    : 0

  return {
    totalDelivered,
    onTimeCount,
    lateCount,
    earlyCount,
    onTimeRate,
    avgDaysVariance,
  }
}

// ============================================================================
// Query: OTD by Driver
// ============================================================================

/**
 * Fetch OTD breakdown grouped by driver.
 */
export async function fetchOTDByDriver(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<OTDByDriver[]> {
  const { startDate: periodStart, endDate: periodEnd } = getDateBounds(dateRange)
  const startDate = format(periodStart, 'yyyy-MM-dd')
  const endDate = format(periodEnd, 'yyyy-MM-dd')

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, updated_at, status, driver_id, driver:drivers(id, first_name, last_name)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .in('status', DELIVERED_STATUSES)
    .not('driver_id', 'is', null)

  if (error) throw error

  const driverMap = new Map<string, {
    driverId: string
    driverName: string
    totalDelivered: number
    onTimeCount: number
    totalVariance: number
    varianceCount: number
  }>()

  for (const order of orders ?? []) {
    const rawOrder = order as RawOrder
    const driver = resolveDriver(rawOrder.driver)
    if (!driver || !rawOrder.driver_id) continue

    const key = rawOrder.driver_id
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        driverId: driver.id,
        driverName: `${driver.first_name} ${driver.last_name}`.trim(),
        totalDelivered: 0,
        onTimeCount: 0,
        totalVariance: 0,
        varianceCount: 0,
      })
    }

    const entry = driverMap.get(key)!
    entry.totalDelivered++

    const variance = computeDaysVariance(rawOrder)
    if (variance !== null) {
      entry.totalVariance += variance
      entry.varianceCount++
      if (variance <= 0) entry.onTimeCount++
    }
  }

  const results: OTDByDriver[] = []
  for (const [, entry] of driverMap) {
    results.push({
      driverId: entry.driverId,
      driverName: entry.driverName,
      totalDelivered: entry.totalDelivered,
      onTimeCount: entry.onTimeCount,
      onTimeRate: entry.totalDelivered > 0
        ? Math.round((entry.onTimeCount / entry.totalDelivered) * 10000) / 100
        : 0,
      avgDaysVariance: entry.varianceCount > 0
        ? Math.round((entry.totalVariance / entry.varianceCount) * 100) / 100
        : 0,
    })
  }

  return results.sort((a, b) => b.onTimeRate - a.onTimeRate)
}

// ============================================================================
// Query: OTD by Broker
// ============================================================================

/**
 * Fetch OTD breakdown grouped by broker.
 */
export async function fetchOTDByBroker(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<OTDByBroker[]> {
  const { startDate: periodStart, endDate: periodEnd } = getDateBounds(dateRange)
  const startDate = format(periodStart, 'yyyy-MM-dd')
  const endDate = format(periodEnd, 'yyyy-MM-dd')

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, updated_at, status, broker_id, broker:brokers(id, name)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .in('status', DELIVERED_STATUSES)
    .not('broker_id', 'is', null)

  if (error) throw error

  const brokerMap = new Map<string, {
    brokerId: string
    brokerName: string
    totalDelivered: number
    onTimeCount: number
    totalVariance: number
    varianceCount: number
  }>()

  for (const order of orders ?? []) {
    const rawOrder = order as RawOrder
    const broker = resolveBroker(rawOrder.broker)
    if (!broker || !rawOrder.broker_id) continue

    const key = rawOrder.broker_id
    if (!brokerMap.has(key)) {
      brokerMap.set(key, {
        brokerId: broker.id,
        brokerName: broker.name,
        totalDelivered: 0,
        onTimeCount: 0,
        totalVariance: 0,
        varianceCount: 0,
      })
    }

    const entry = brokerMap.get(key)!
    entry.totalDelivered++

    const variance = computeDaysVariance(rawOrder)
    if (variance !== null) {
      entry.totalVariance += variance
      entry.varianceCount++
      if (variance <= 0) entry.onTimeCount++
    }
  }

  const results: OTDByBroker[] = []
  for (const [, entry] of brokerMap) {
    results.push({
      brokerId: entry.brokerId,
      brokerName: entry.brokerName,
      totalDelivered: entry.totalDelivered,
      onTimeCount: entry.onTimeCount,
      onTimeRate: entry.totalDelivered > 0
        ? Math.round((entry.onTimeCount / entry.totalDelivered) * 10000) / 100
        : 0,
      avgDaysVariance: entry.varianceCount > 0
        ? Math.round((entry.totalVariance / entry.varianceCount) * 100) / 100
        : 0,
    })
  }

  return results.sort((a, b) => b.onTimeRate - a.onTimeRate)
}

// ============================================================================
// Query: OTD Trend (monthly, last N months)
// ============================================================================

/**
 * Fetch monthly OTD trend for the last N months (default 6).
 * Each bucket covers a full calendar month.
 */
export async function fetchOTDTrend(
  supabase: SupabaseClient,
  months = 6
): Promise<OTDTrend[]> {
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, months - 1))

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, delivery_date, updated_at, status, created_at')
    .gte('created_at', format(rangeStart, 'yyyy-MM-dd'))
    .lte('created_at', format(endOfMonth(now), 'yyyy-MM-dd'))
    .in('status', DELIVERED_STATUSES)

  if (error) throw error

  // Build month buckets
  const bucketMap = new Map<string, {
    totalDelivered: number
    onTimeCount: number
    lateCount: number
  }>()

  // Pre-populate buckets so empty months still appear
  for (let i = months - 1; i >= 0; i--) {
    const monthKey = format(subMonths(now, i), 'MMM yyyy')
    bucketMap.set(monthKey, { totalDelivered: 0, onTimeCount: 0, lateCount: 0 })
  }

  for (const order of orders ?? []) {
    const rawOrder = order as RawOrder & { created_at: string }
    const monthKey = format(new Date(rawOrder.created_at), 'MMM yyyy')

    if (!bucketMap.has(monthKey)) continue

    const bucket = bucketMap.get(monthKey)!
    bucket.totalDelivered++

    const variance = computeDaysVariance(rawOrder)
    if (variance !== null) {
      if (variance <= 0) {
        bucket.onTimeCount++
      } else {
        bucket.lateCount++
      }
    }
  }

  const trend: OTDTrend[] = []
  for (const [month, bucket] of bucketMap) {
    trend.push({
      month,
      totalDelivered: bucket.totalDelivered,
      lateCount: bucket.lateCount,
      onTimeRate: bucket.totalDelivered > 0
        ? Math.round((bucket.onTimeCount / bucket.totalDelivered) * 10000) / 100
        : 0,
    })
  }

  return trend
}
