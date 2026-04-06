import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from './financials'

// ============================================================================
// Types
// ============================================================================

export interface BrokerScore {
  brokerId: string
  brokerName: string
  // Volume
  totalOrders: number
  totalRevenue: number
  // Profitability
  totalBrokerFees: number
  avgMargin: number // (revenue - brokerFee - localFee) / revenue * 100
  avgRevenuePerOrder: number
  // Reliability (OTD)
  deliveredOrders: number
  onTimeRate: number // % of delivered orders that were on-time
  // Payment
  paidOrders: number
  avgDaysToPay: number // avg days from delivery_date to when status became 'paid'
  // Composite
  compositeScore: number // 0-100 weighted score
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface BrokerSummary {
  totalBrokers: number
  avgScore: number
  topBrokerName: string
  worstBrokerName: string
  totalRevenue: number
}

// ============================================================================
// Internal accumulator
// ============================================================================

interface BrokerAccumulator {
  brokerId: string
  brokerName: string
  totalOrders: number
  totalRevenue: number
  totalBrokerFees: number
  totalLocalFees: number
  totalCleanGross: number
  deliveredOrders: number
  onTimeDeliveries: number
  paidOrders: number
  totalDaysToPay: number
}

// ============================================================================
// Helpers
// ============================================================================

function round2(val: number): number {
  return Math.round(val * 100) / 100
}

function assignGrade(score: number): BrokerScore['grade'] {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

/**
 * Composite score weighting:
 *   Margin contribution : 30%  (higher margin = better)
 *   On-time rate        : 25%  (higher = better)
 *   Payment speed       : 25%  (faster = better, cap at 60 days)
 *   Volume consistency  : 20%  (more orders = better, normalized to max broker)
 */
function computeCompositeScore(
  accum: BrokerAccumulator,
  maxOrders: number
): number {
  const revenue = accum.totalRevenue

  // Margin component: avg margin normalised to 0-100
  const cleanGross = accum.totalCleanGross
  const marginPct = revenue > 0 ? (cleanGross / revenue) * 100 : 0
  // Clamp to 0-100 (margins over 100% are treated as 100)
  const marginScore = Math.min(Math.max(marginPct, 0), 100)

  // On-time rate component: already a percentage 0-100
  const otdScore = accum.deliveredOrders > 0
    ? Math.min((accum.onTimeDeliveries / accum.deliveredOrders) * 100, 100)
    : 0

  // Payment speed component: inverse of avg days, capped at 60
  const avgDays = accum.paidOrders > 0 ? accum.totalDaysToPay / accum.paidOrders : 60
  const cappedDays = Math.min(avgDays, 60)
  const paymentScore = ((60 - cappedDays) / 60) * 100

  // Volume consistency component: normalised to max broker
  const volumeScore = maxOrders > 0 ? (accum.totalOrders / maxOrders) * 100 : 0

  const composite =
    marginScore * 0.30 +
    otdScore * 0.25 +
    paymentScore * 0.25 +
    volumeScore * 0.20

  return round2(Math.min(Math.max(composite, 0), 100))
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch and compute a composite scorecard per broker.
 * RLS handles tenant isolation — no explicit tenant_id needed.
 */
export async function fetchBrokerScorecard(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<BrokerScore[]> {
  const { startDate: periodStart, endDate: periodEnd } = getDateBounds(dateRange)
  const startDate = format(periodStart, 'yyyy-MM-dd')
  const endDate = format(periodEnd, 'yyyy-MM-dd')

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'broker_id, revenue, broker_fee, local_fee, carrier_pay, status, payment_status, delivery_date, updated_at, broker:brokers(id, name)'
    )
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'cancelled')

  if (error) throw error

  // Aggregate per broker
  const accumMap = new Map<string, BrokerAccumulator>()

  for (const order of orders ?? []) {
    if (!order.broker_id) continue

    // Handle Supabase embedded join result (may be array or object)
    const brokerRaw = order.broker as unknown as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    const broker = Array.isArray(brokerRaw) ? (brokerRaw[0] ?? null) : brokerRaw
    const brokerName = broker?.name ?? 'Unknown Broker'

    if (!accumMap.has(order.broker_id)) {
      accumMap.set(order.broker_id, {
        brokerId: order.broker_id,
        brokerName,
        totalOrders: 0,
        totalRevenue: 0,
        totalBrokerFees: 0,
        totalLocalFees: 0,
        totalCleanGross: 0,
        deliveredOrders: 0,
        onTimeDeliveries: 0,
        paidOrders: 0,
        totalDaysToPay: 0,
      })
    }

    const acc = accumMap.get(order.broker_id)!

    const revenue = parseFloat(order.revenue ?? '0')
    const brokerFee = parseFloat(order.broker_fee ?? '0')
    const localFee = parseFloat(order.local_fee ?? '0')
    const cleanGross = revenue - brokerFee - localFee

    acc.totalOrders += 1
    acc.totalRevenue += revenue
    acc.totalBrokerFees += brokerFee
    acc.totalLocalFees += localFee
    acc.totalCleanGross += cleanGross

    // OTD: orders with delivery_date are considered; delivered if delivery_date <= updated_at date
    const isDelivered =
      order.status === 'delivered' ||
      order.status === 'invoiced' ||
      order.status === 'paid'

    if (isDelivered && order.delivery_date) {
      acc.deliveredOrders += 1
      // On-time: delivery_date >= actual delivery (updated_at same day or earlier)
      // Heuristic: updated_at date <= delivery_date means delivered on or before promised date
      const deliveryDate = new Date(order.delivery_date)
      const updatedDate = new Date(order.updated_at)
      if (updatedDate <= deliveryDate) {
        acc.onTimeDeliveries += 1
      }
    }

    // Payment speed: for orders with payment_status 'paid'
    if (order.payment_status === 'paid' && order.delivery_date) {
      const deliveryDate = new Date(order.delivery_date)
      const paidDate = new Date(order.updated_at)
      const diffMs = paidDate.getTime() - deliveryDate.getTime()
      const diffDays = Math.max(diffMs / (1000 * 60 * 60 * 24), 0)
      acc.paidOrders += 1
      acc.totalDaysToPay += diffDays
    }
  }

  if (accumMap.size === 0) return []

  // Find max orders for volume normalisation
  const maxOrders = Math.max(...Array.from(accumMap.values()).map((a) => a.totalOrders), 1)

  // Build BrokerScore array
  const scores: BrokerScore[] = Array.from(accumMap.values()).map((acc) => {
    const avgMargin =
      acc.totalRevenue > 0
        ? round2((acc.totalCleanGross / acc.totalRevenue) * 100)
        : 0

    const avgRevenuePerOrder =
      acc.totalOrders > 0 ? round2(acc.totalRevenue / acc.totalOrders) : 0

    const onTimeRate =
      acc.deliveredOrders > 0
        ? round2((acc.onTimeDeliveries / acc.deliveredOrders) * 100)
        : 0

    const avgDaysToPay =
      acc.paidOrders > 0 ? round2(acc.totalDaysToPay / acc.paidOrders) : 0

    const compositeScore = computeCompositeScore(acc, maxOrders)
    const grade = assignGrade(compositeScore)

    return {
      brokerId: acc.brokerId,
      brokerName: acc.brokerName,
      totalOrders: acc.totalOrders,
      totalRevenue: round2(acc.totalRevenue),
      totalBrokerFees: round2(acc.totalBrokerFees),
      avgMargin,
      avgRevenuePerOrder,
      deliveredOrders: acc.deliveredOrders,
      onTimeRate,
      paidOrders: acc.paidOrders,
      avgDaysToPay,
      compositeScore,
      grade,
    }
  })

  // Sort by composite score descending
  return scores.sort((a, b) => b.compositeScore - a.compositeScore)
}

/**
 * Compute summary statistics from a set of broker scores.
 */
export function computeBrokerSummary(scores: BrokerScore[]): BrokerSummary {
  if (scores.length === 0) {
    return {
      totalBrokers: 0,
      avgScore: 0,
      topBrokerName: '—',
      worstBrokerName: '—',
      totalRevenue: 0,
    }
  }

  const totalRevenue = scores.reduce((sum, s) => sum + s.totalRevenue, 0)
  const avgScore = round2(
    scores.reduce((sum, s) => sum + s.compositeScore, 0) / scores.length
  )

  // Scores are already sorted desc by compositeScore
  const topBrokerName = scores[0].brokerName
  const worstBrokerName = scores[scores.length - 1].brokerName

  return {
    totalBrokers: scores.length,
    avgScore,
    topBrokerName,
    worstBrokerName,
    totalRevenue: round2(totalRevenue),
  }
}
