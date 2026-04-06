import type { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from './financials'

// ============================================================================
// Types
// ============================================================================

export interface LaneProfitability {
  lane: string // "GA → FL"
  pickupState: string
  deliveryState: string
  revenue: number
  brokerFees: number
  localFees: number
  carrierPay: number
  cleanGross: number
  profit: number
  margin: number
  loadCount: number
  totalMiles: number
  avgRevenue: number
  avgProfit: number
  rpm: number | null // revenue per mile
  cpm: number | null // cost per mile
  ppm: number | null // profit per mile
}

export interface LaneSummary {
  totalLanes: number
  profitableLanes: number
  unprofitableLanes: number
  totalRevenue: number
  totalProfit: number
  avgMargin: number
  totalLoads: number
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch profitability aggregated by lane (pickup_state → delivery_state).
 * Groups all orders by origin/destination state pair and computes financial metrics.
 */
export async function fetchLaneProfitability(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<LaneProfitability[]> {
  const { startDate: periodStart, endDate: periodEnd } = getDateBounds(dateRange)
  const startDate = format(periodStart, 'yyyy-MM-dd')
  const endDate = format(periodEnd, 'yyyy-MM-dd')

  // Fetch orders with location and financial data
  const { data: orders, error } = await supabase
    .from('orders')
    .select('pickup_state, delivery_state, revenue, broker_fee, local_fee, carrier_pay, distance_miles, status')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .neq('status', 'cancelled')

  if (error) throw error

  // Aggregate by lane
  const laneMap = new Map<string, {
    pickupState: string
    deliveryState: string
    revenue: number
    brokerFees: number
    localFees: number
    carrierPay: number
    loadCount: number
    totalMiles: number
  }>()

  for (const order of orders ?? []) {
    const pickupState = order.pickup_state?.trim()
    const deliveryState = order.delivery_state?.trim()

    // Skip orders without both states
    if (!pickupState || !deliveryState) continue

    const laneKey = `${pickupState}→${deliveryState}`

    if (!laneMap.has(laneKey)) {
      laneMap.set(laneKey, {
        pickupState,
        deliveryState,
        revenue: 0,
        brokerFees: 0,
        localFees: 0,
        carrierPay: 0,
        loadCount: 0,
        totalMiles: 0,
      })
    }

    const entry = laneMap.get(laneKey)!
    entry.revenue += parseFloat(order.revenue ?? '0')
    entry.brokerFees += parseFloat(order.broker_fee ?? '0')
    entry.localFees += parseFloat(order.local_fee ?? '0')
    entry.carrierPay += parseFloat(order.carrier_pay ?? '0')
    entry.loadCount += 1
    entry.totalMiles += parseFloat(order.distance_miles ?? '0')
  }

  // Compute derived metrics
  const lanes: LaneProfitability[] = []

  for (const [, entry] of laneMap) {
    const cleanGross = entry.revenue - entry.brokerFees - entry.localFees
    const totalCosts = entry.brokerFees + entry.localFees + entry.carrierPay
    const profit = entry.revenue - totalCosts
    const margin = entry.revenue > 0
      ? Math.round((profit / entry.revenue) * 10000) / 100
      : 0

    const hasMiles = entry.totalMiles > 0
    const rpm = hasMiles ? Math.round((entry.revenue / entry.totalMiles) * 100) / 100 : null
    const cpm = hasMiles ? Math.round((totalCosts / entry.totalMiles) * 100) / 100 : null
    const ppm = hasMiles ? Math.round((profit / entry.totalMiles) * 100) / 100 : null

    lanes.push({
      lane: `${entry.pickupState} → ${entry.deliveryState}`,
      pickupState: entry.pickupState,
      deliveryState: entry.deliveryState,
      revenue: Math.round(entry.revenue * 100) / 100,
      brokerFees: Math.round(entry.brokerFees * 100) / 100,
      localFees: Math.round(entry.localFees * 100) / 100,
      carrierPay: Math.round(entry.carrierPay * 100) / 100,
      cleanGross: Math.round(cleanGross * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin,
      loadCount: entry.loadCount,
      totalMiles: Math.round(entry.totalMiles * 10) / 10,
      avgRevenue: entry.loadCount > 0 ? Math.round((entry.revenue / entry.loadCount) * 100) / 100 : 0,
      avgProfit: entry.loadCount > 0 ? Math.round((profit / entry.loadCount) * 100) / 100 : 0,
      rpm,
      cpm,
      ppm,
    })
  }

  // Sort by profit descending
  return lanes.sort((a, b) => b.profit - a.profit)
}

/**
 * Compute summary statistics from lane data.
 */
export function computeLaneSummary(lanes: LaneProfitability[]): LaneSummary {
  const totalRevenue = lanes.reduce((sum, l) => sum + l.revenue, 0)
  const totalProfit = lanes.reduce((sum, l) => sum + l.profit, 0)
  const totalLoads = lanes.reduce((sum, l) => sum + l.loadCount, 0)
  const profitableLanes = lanes.filter((l) => l.profit > 0).length
  const unprofitableLanes = lanes.filter((l) => l.profit <= 0).length

  return {
    totalLanes: lanes.length,
    profitableLanes,
    unprofitableLanes,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    avgMargin: totalRevenue > 0
      ? Math.round((totalProfit / totalRevenue) * 10000) / 100
      : 0,
    totalLoads,
  }
}
