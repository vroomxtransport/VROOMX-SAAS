import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInDays, subDays } from 'date-fns'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from './financials'

// ============================================================================
// Types
// ============================================================================

export interface DriverPerformance {
  driverId: string
  driverName: string
  driverType: string
  // Volume
  tripCount: number
  orderCount: number
  totalMiles: number
  // Financial
  revenue: number
  driverPay: number
  cleanGross: number
  profitContribution: number // cleanGross - driverPay
  avgRevenuePerTrip: number
  // Efficiency
  rpm: number | null // revenue per mile
  ppm: number | null // profit per mile
  // Utilization (tripCount / daysInPeriod * 30 * 100 capped at 100)
  utilizationPct: number
  // OTD
  deliveredOrders: number
  onTimeRate: number
  // Overall
  performanceScore: number // 0–100
  trend: 'improving' | 'stable' | 'declining'
}

export interface DriverSummary {
  totalDrivers: number
  avgPerformanceScore: number
  topDriverName: string
  totalRevenue: number
  avgUtilization: number
}

// ============================================================================
// Internal raw types for Supabase embedded selects
// ============================================================================

interface DriverEmbedded {
  id: string
  first_name: string
  last_name: string
  driver_type: string
}

interface TripRaw {
  driver_id: string | null
  total_revenue: string | null
  total_broker_fees: string | null
  total_local_fees: string | null
  driver_pay: string | null
  order_count: number | null
  total_miles: string | null
  start_date: string | null
  driver: DriverEmbedded | DriverEmbedded[] | null
}

interface OrderRaw {
  driver_id: string | null
  delivery_date: string | null
  updated_at: string | null
  status: string | null
}

// ============================================================================
// Helpers
// ============================================================================

function resolveDriver(raw: TripRaw['driver']): DriverEmbedded | null {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw
}

function isOnTime(order: OrderRaw): boolean {
  // On-time if delivered by delivery_date or if no delivery_date set
  if (!order.delivery_date) return true
  const deliveredAt = order.updated_at ? new Date(order.updated_at) : null
  if (!deliveredAt) return true
  return deliveredAt <= new Date(order.delivery_date)
}

/**
 * Compute 0–100 performance score from normalized sub-scores.
 * Weights: revenue contribution 25%, profit per mile 25%, on-time rate 25%, utilization 25%
 */
function computeScore(
  revenue: number,
  ppm: number | null,
  onTimeRate: number,
  utilizationPct: number,
  maxRevenue: number,
  maxPpm: number
): number {
  const revScore = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0
  const ppmScore = ppm !== null && maxPpm > 0 ? Math.min((ppm / maxPpm) * 100, 100) : 0
  const otdScore = onTimeRate // already 0–100
  const utilScore = utilizationPct // already 0–100

  const weighted = revScore * 0.25 + ppmScore * 0.25 + otdScore * 0.25 + utilScore * 0.25
  return Math.round(Math.min(Math.max(weighted, 0), 100))
}

// ============================================================================
// Aggregation
// ============================================================================

interface DriverAccumulator {
  driverId: string
  driverName: string
  driverType: string
  tripCount: number
  orderCount: number
  totalMiles: number
  revenue: number
  brokerFees: number
  localFees: number
  driverPay: number
}

function aggregateTrips(trips: TripRaw[]): Map<string, DriverAccumulator> {
  const map = new Map<string, DriverAccumulator>()

  for (const trip of trips) {
    const driver = resolveDriver(trip.driver)
    if (!driver || !trip.driver_id) continue

    const existing = map.get(trip.driver_id)
    const revenue = parseFloat(trip.total_revenue ?? '0')
    const brokerFees = parseFloat(trip.total_broker_fees ?? '0')
    const localFees = parseFloat(trip.total_local_fees ?? '0')
    const driverPay = parseFloat(trip.driver_pay ?? '0')
    const miles = parseFloat(trip.total_miles ?? '0')
    const orders = trip.order_count ?? 0

    if (existing) {
      existing.tripCount += 1
      existing.orderCount += orders
      existing.totalMiles += miles
      existing.revenue += revenue
      existing.brokerFees += brokerFees
      existing.localFees += localFees
      existing.driverPay += driverPay
    } else {
      map.set(trip.driver_id, {
        driverId: trip.driver_id,
        driverName: `${driver.first_name} ${driver.last_name}`.trim(),
        driverType: driver.driver_type,
        tripCount: 1,
        orderCount: orders,
        totalMiles: miles,
        revenue,
        brokerFees,
        localFees,
        driverPay,
      })
    }
  }

  return map
}

interface OtdAccumulator {
  delivered: number
  onTime: number
}

function aggregateOtd(orders: OrderRaw[]): Map<string, OtdAccumulator> {
  const map = new Map<string, OtdAccumulator>()

  for (const order of orders) {
    if (!order.driver_id) continue
    const existing = map.get(order.driver_id) ?? { delivered: 0, onTime: 0 }
    existing.delivered += 1
    if (isOnTime(order)) existing.onTime += 1
    map.set(order.driver_id, existing)
  }

  return map
}

// ============================================================================
// Trend helpers — compare current period score to prior equivalent period
// ============================================================================

interface PriorScoreMap {
  [driverId: string]: number
}

async function fetchPriorScores(
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date
): Promise<PriorScoreMap> {
  const daysInPeriod = Math.max(differenceInDays(endDate, startDate), 1)
  const priorEnd = subDays(startDate, 1)
  const priorStart = subDays(priorEnd, daysInPeriod - 1)

  const { data: trips } = await supabase
    .from('trips')
    .select(
      'driver_id, total_revenue, total_broker_fees, total_local_fees, driver_pay, order_count, total_miles, start_date, driver:drivers(id, first_name, last_name, driver_type)'
    )
    .gte('start_date', priorStart.toISOString().split('T')[0])
    .lte('start_date', priorEnd.toISOString().split('T')[0])

  if (!trips || trips.length === 0) return {}

  const { data: orders } = await supabase
    .from('orders')
    .select('driver_id, delivery_date, updated_at, status')
    .in('status', ['delivered', 'invoiced', 'paid'])
    .gte('created_at', priorStart.toISOString())
    .lte('created_at', priorEnd.toISOString())

  const driverMap = aggregateTrips(trips as TripRaw[])
  const otdMap = aggregateOtd((orders ?? []) as OrderRaw[])

  const drivers = Array.from(driverMap.values())
  const maxRevenue = Math.max(...drivers.map((d) => d.revenue), 1)
  const maxPpm = Math.max(
    ...drivers.map((d) => {
      const cleanGross = d.revenue - d.brokerFees - d.localFees
      const profit = cleanGross - d.driverPay
      return d.totalMiles > 0 ? profit / d.totalMiles : 0
    }),
    0.01
  )

  const priorScores: PriorScoreMap = {}

  for (const d of drivers) {
    const cleanGross = d.revenue - d.brokerFees - d.localFees
    const profit = cleanGross - d.driverPay
    const ppm = d.totalMiles > 0 ? profit / d.totalMiles : null
    const otd = otdMap.get(d.driverId)
    const onTimeRate = otd && otd.delivered > 0 ? (otd.onTime / otd.delivered) * 100 : 0
    const utilPct = Math.min((d.tripCount / daysInPeriod) * 30 * 100, 100)

    priorScores[d.driverId] = computeScore(
      d.revenue,
      ppm,
      onTimeRate,
      utilPct,
      maxRevenue,
      maxPpm
    )
  }

  return priorScores
}

// ============================================================================
// Main query function
// ============================================================================

export async function fetchDriverPerformance(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<DriverPerformance[]> {
  const { startDate, endDate } = getDateBounds(dateRange)
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]
  const daysInPeriod = Math.max(differenceInDays(endDate, startDate), 1)

  // Fetch trips with embedded driver for financials
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select(
      'driver_id, total_revenue, total_broker_fees, total_local_fees, driver_pay, order_count, total_miles, start_date, driver:drivers(id, first_name, last_name, driver_type)'
    )
    .gte('start_date', startStr)
    .lte('start_date', endStr)

  if (tripsError) throw tripsError

  // Fetch orders for OTD calculation
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('driver_id, delivery_date, updated_at, status')
    .in('status', ['delivered', 'invoiced', 'paid'])
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (ordersError) throw ordersError

  const driverMap = aggregateTrips((trips ?? []) as TripRaw[])
  const otdMap = aggregateOtd((orders ?? []) as OrderRaw[])

  if (driverMap.size === 0) return []

  const drivers = Array.from(driverMap.values())

  // Compute normalization maxima for scoring
  const maxRevenue = Math.max(...drivers.map((d) => d.revenue), 1)
  const ppms = drivers.map((d) => {
    const cleanGross = d.revenue - d.brokerFees - d.localFees
    const profit = cleanGross - d.driverPay
    return d.totalMiles > 0 ? profit / d.totalMiles : 0
  })
  const maxPpm = Math.max(...ppms, 0.01)

  // Fetch prior period scores for trend calculation
  const priorScores = await fetchPriorScores(supabase, startDate, endDate)

  return drivers.map((d) => {
    const cleanGross = d.revenue - d.brokerFees - d.localFees
    const profitContribution = cleanGross - d.driverPay
    const rpm = d.totalMiles > 0 ? d.revenue / d.totalMiles : null
    const ppm = d.totalMiles > 0 ? profitContribution / d.totalMiles : null
    const avgRevenuePerTrip = d.tripCount > 0 ? d.revenue / d.tripCount : 0
    const utilizationPct = Math.min((d.tripCount / daysInPeriod) * 30 * 100, 100)

    const otd = otdMap.get(d.driverId)
    const deliveredOrders = otd?.delivered ?? 0
    const onTimeRate = otd && otd.delivered > 0 ? (otd.onTime / otd.delivered) * 100 : 0

    const performanceScore = computeScore(
      d.revenue,
      ppm,
      onTimeRate,
      utilizationPct,
      maxRevenue,
      maxPpm
    )

    const priorScore = priorScores[d.driverId]
    let trend: DriverPerformance['trend'] = 'stable'
    if (priorScore !== undefined) {
      const delta = performanceScore - priorScore
      if (delta > 5) trend = 'improving'
      else if (delta < -5) trend = 'declining'
    }

    return {
      driverId: d.driverId,
      driverName: d.driverName,
      driverType: d.driverType,
      tripCount: d.tripCount,
      orderCount: d.orderCount,
      totalMiles: Math.round(d.totalMiles),
      revenue: Math.round(d.revenue * 100) / 100,
      driverPay: Math.round(d.driverPay * 100) / 100,
      cleanGross: Math.round(cleanGross * 100) / 100,
      profitContribution: Math.round(profitContribution * 100) / 100,
      avgRevenuePerTrip: Math.round(avgRevenuePerTrip * 100) / 100,
      rpm: rpm !== null ? Math.round(rpm * 100) / 100 : null,
      ppm: ppm !== null ? Math.round(ppm * 100) / 100 : null,
      utilizationPct: Math.round(utilizationPct * 10) / 10,
      deliveredOrders,
      onTimeRate: Math.round(onTimeRate * 10) / 10,
      performanceScore,
      trend,
    }
  })
}

// ============================================================================
// Summary computation
// ============================================================================

export function computeDriverSummary(drivers: DriverPerformance[]): DriverSummary {
  if (drivers.length === 0) {
    return {
      totalDrivers: 0,
      avgPerformanceScore: 0,
      topDriverName: '—',
      totalRevenue: 0,
      avgUtilization: 0,
    }
  }

  const totalRevenue = drivers.reduce((sum, d) => sum + d.revenue, 0)
  const avgPerformanceScore =
    Math.round(
      (drivers.reduce((sum, d) => sum + d.performanceScore, 0) / drivers.length) * 10
    ) / 10
  const avgUtilization =
    Math.round(
      (drivers.reduce((sum, d) => sum + d.utilizationPct, 0) / drivers.length) * 10
    ) / 10

  const topDriver = drivers.reduce((best, d) =>
    d.performanceScore > best.performanceScore ? d : best
  )

  return {
    totalDrivers: drivers.length,
    avgPerformanceScore,
    topDriverName: topDriver.driverName,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgUtilization,
  }
}
