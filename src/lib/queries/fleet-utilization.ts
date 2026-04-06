import type { SupabaseClient } from '@supabase/supabase-js'
import { format, differenceInDays } from 'date-fns'
import type { DateRange } from '@/types/filters'
import { getDateBounds } from './financials'

// ============================================================================
// Types
// ============================================================================

export interface TruckUtilization {
  truckId: string
  unitNumber: string
  make: string
  model: string
  year: number | null
  status: string
  // Activity
  tripCount: number
  orderCount: number
  totalMiles: number
  activeDays: number // days with trips starting in period
  idleDays: number // days without trips
  utilizationPct: number // activeDays / daysInPeriod * 100
  // Financial
  revenue: number
  expenses: number // brokerFees + localFees + driverPay + tripExpenses + carrierPay
  profit: number
  revenuePerDay: number
  revenuePerMile: number | null
  profitPerMile: number | null
  // Efficiency
  avgOrdersPerTrip: number
  avgMilesPerTrip: number
}

export interface FleetSummary {
  totalTrucks: number
  activeTrucks: number
  avgUtilization: number
  totalRevenue: number
  totalProfit: number
  revenuePerTruck: number
  profitPerTruck: number
  totalMiles: number
}

// ============================================================================
// Internal row shapes from Supabase
// ============================================================================

interface TruckRow {
  id: string
  unit_number: string
  make: string | null
  model: string | null
  year: number | null
  truck_status: string
}

interface TripRow {
  truck_id: string | null
  total_revenue: string | null
  total_broker_fees: string | null
  total_local_fees: string | null
  driver_pay: string | null
  total_expenses: string | null
  carrier_pay: string | null
  order_count: number | null
  total_miles: string | null
  start_date: string | null
  end_date: string | null
  truck: TruckRow | TruckRow[] | null
}

// ============================================================================
// Query
// ============================================================================

/**
 * Fetch fleet utilization data for all active trucks within the given period.
 * All aggregation is done in JavaScript — RLS handles tenant filtering.
 */
export async function fetchFleetUtilization(
  supabase: SupabaseClient,
  dateRange?: DateRange
): Promise<TruckUtilization[]> {
  const { startDate, endDate } = getDateBounds(dateRange)
  const startISO = format(startDate, 'yyyy-MM-dd')
  const endISO = format(endDate, 'yyyy-MM-dd')

  const totalDaysInPeriod = Math.max(differenceInDays(endDate, startDate) + 1, 1)

  // Parallel: all active trucks + trips with embedded truck info
  const [trucksRes, tripsRes] = await Promise.all([
    supabase
      .from('trucks')
      .select('id, unit_number, make, model, year, truck_status')
      .eq('truck_status', 'active'),
    supabase
      .from('trips')
      .select(
        'truck_id, total_revenue, total_broker_fees, total_local_fees, driver_pay, total_expenses, carrier_pay, order_count, total_miles, start_date, end_date, truck:trucks(id, unit_number, make, model, year, truck_status)'
      )
      .gte('start_date', startISO)
      .lte('start_date', endISO),
  ])

  if (trucksRes.error) throw trucksRes.error

  const allTrucks = (trucksRes.data ?? []) as TruckRow[]
  const trips = (tripsRes.data ?? []) as TripRow[]

  // Build a known set of active truck IDs for merging trips from inactive trucks
  const truckMap = new Map<string, TruckRow>()
  for (const t of allTrucks) {
    truckMap.set(t.id, t)
  }

  // Also surface any trucks referenced in trips that weren't in the active-only query
  // (e.g. a truck assigned to a trip but later set to inactive)
  for (const trip of trips) {
    const tid = trip.truck_id
    if (!tid || truckMap.has(tid)) continue
    const raw = trip.truck
    const truckData = Array.isArray(raw) ? (raw[0] ?? null) : raw
    if (truckData) {
      truckMap.set(tid, truckData)
    }
  }

  // Accumulator per truck_id
  interface TruckAccum {
    truckInfo: TruckRow
    tripCount: number
    orderCount: number
    totalMiles: number
    activeDates: Set<string>
    revenue: number
    expenses: number
  }

  const accumMap = new Map<string, TruckAccum>()

  // Initialize every known truck with zero values
  for (const [id, info] of truckMap.entries()) {
    accumMap.set(id, {
      truckInfo: info,
      tripCount: 0,
      orderCount: 0,
      totalMiles: 0,
      activeDates: new Set<string>(),
      revenue: 0,
      expenses: 0,
    })
  }

  // Aggregate trips
  for (const trip of trips) {
    const tid = trip.truck_id
    if (!tid) continue

    let accum = accumMap.get(tid)
    if (!accum) {
      // Truck not yet in map (edge case: trip without active truck)
      const raw = trip.truck
      const truckData = Array.isArray(raw) ? (raw[0] ?? null) : raw
      if (!truckData) continue
      accum = {
        truckInfo: truckData,
        tripCount: 0,
        orderCount: 0,
        totalMiles: 0,
        activeDates: new Set<string>(),
        revenue: 0,
        expenses: 0,
      }
      accumMap.set(tid, accum)
    }

    accum.tripCount += 1
    accum.orderCount += trip.order_count ?? 0
    accum.totalMiles += parseFloat(trip.total_miles ?? '0')

    const revenue = parseFloat(trip.total_revenue ?? '0')
    const brokerFees = parseFloat(trip.total_broker_fees ?? '0')
    const localFees = parseFloat(trip.total_local_fees ?? '0')
    const driverPay = parseFloat(trip.driver_pay ?? '0')
    const tripExpenses = parseFloat(trip.total_expenses ?? '0')
    const carrierPay = parseFloat(trip.carrier_pay ?? '0')

    accum.revenue += revenue
    accum.expenses += brokerFees + localFees + driverPay + tripExpenses + carrierPay

    if (trip.start_date) {
      accum.activeDates.add(trip.start_date)
    }
  }

  // Build result rows
  const result: TruckUtilization[] = []

  for (const [, accum] of accumMap.entries()) {
    const { truckInfo, tripCount, orderCount, totalMiles, activeDates, revenue, expenses } = accum
    const profit = revenue - expenses
    const activeDays = activeDates.size
    const idleDays = Math.max(totalDaysInPeriod - activeDays, 0)
    const utilizationPct = Math.min((activeDays / totalDaysInPeriod) * 100, 100)
    const revenuePerDay = activeDays > 0 ? revenue / totalDaysInPeriod : 0
    const revenuePerMile = totalMiles > 0 ? revenue / totalMiles : null
    const profitPerMile = totalMiles > 0 ? profit / totalMiles : null
    const avgOrdersPerTrip = tripCount > 0 ? orderCount / tripCount : 0
    const avgMilesPerTrip = tripCount > 0 ? totalMiles / tripCount : 0

    result.push({
      truckId: truckInfo.id,
      unitNumber: truckInfo.unit_number,
      make: truckInfo.make ?? '',
      model: truckInfo.model ?? '',
      year: truckInfo.year,
      status: truckInfo.truck_status,
      tripCount,
      orderCount,
      totalMiles: Math.round(totalMiles),
      activeDays,
      idleDays,
      utilizationPct: Math.round(utilizationPct * 10) / 10,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      revenuePerDay: Math.round(revenuePerDay * 100) / 100,
      revenuePerMile: revenuePerMile !== null ? Math.round(revenuePerMile * 100) / 100 : null,
      profitPerMile: profitPerMile !== null ? Math.round(profitPerMile * 100) / 100 : null,
      avgOrdersPerTrip: Math.round(avgOrdersPerTrip * 10) / 10,
      avgMilesPerTrip: Math.round(avgMilesPerTrip),
    })
  }

  // Sort: highest utilization first
  result.sort((a, b) => b.utilizationPct - a.utilizationPct)

  return result
}

// ============================================================================
// Summary Computation
// ============================================================================

/**
 * Derive fleet-wide summary KPIs from the per-truck utilization array.
 * Pure function — no DB access.
 */
export function computeFleetSummary(trucks: TruckUtilization[]): FleetSummary {
  const totalTrucks = trucks.length
  const activeTrucks = trucks.filter((t) => t.tripCount > 0).length
  const avgUtilization =
    totalTrucks > 0
      ? Math.round((trucks.reduce((sum, t) => sum + t.utilizationPct, 0) / totalTrucks) * 10) / 10
      : 0
  const totalRevenue = Math.round(trucks.reduce((sum, t) => sum + t.revenue, 0) * 100) / 100
  const totalProfit = Math.round(trucks.reduce((sum, t) => sum + t.profit, 0) * 100) / 100
  const totalMiles = trucks.reduce((sum, t) => sum + t.totalMiles, 0)
  const revenuePerTruck =
    totalTrucks > 0 ? Math.round((totalRevenue / totalTrucks) * 100) / 100 : 0
  const profitPerTruck =
    totalTrucks > 0 ? Math.round((totalProfit / totalTrucks) * 100) / 100 : 0

  return {
    totalTrucks,
    activeTrucks,
    avgUtilization,
    totalRevenue,
    totalProfit,
    revenuePerTruck,
    profitPerTruck,
    totalMiles,
  }
}
