import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfMonth, startOfQuarter, startOfYear, endOfMonth, subMonths, subDays, format } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

export interface FinancialSummary {
  revenueMTD: number
  expensesMTD: number
  netProfitMTD: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  expenses: number
}

export interface TopBroker {
  brokerName: string
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
}

export type FinancialPeriod = 'mtd' | 'qtd' | 'ytd' | 'last30' | 'last90'

export interface KPIAggregates {
  totalRevenue: number
  totalBrokerFees: number
  totalDriverPay: number
  totalTripExpenses: number
  totalCarrierPay: number
  totalMiles: number
  orderCount: number
  truckCount: number
  completedTripCount: number
  // Expense detail for breakdown
  expensesByCategory: {
    fuel: number
    tolls: number
    repairs: number
    lodging: number
    misc: number
  }
}

export interface ProfitByTruck {
  truckId: string
  unitNumber: string
  revenue: number
  expenses: number
  profit: number
  margin: number
  tripCount: number
  miles: number
}

export interface ProfitByDriver {
  driverId: string
  name: string
  driverType: string
  revenue: number
  driverPay: number
  tripCount: number
  profitMargin: number
}

export interface MonthlyKPITrend {
  month: string
  revenue: number
  expenses: number
  miles: number
  rpm: number | null
  cpm: number | null
  ppm: number | null
  grossMargin: number
  netMargin: number
  operatingRatio: number
}

// ============================================================================
// Period Helpers
// ============================================================================

function getPeriodStart(period: FinancialPeriod): Date {
  const now = new Date()
  switch (period) {
    case 'mtd': return startOfMonth(now)
    case 'qtd': return startOfQuarter(now)
    case 'ytd': return startOfYear(now)
    case 'last30': return subDays(now, 30)
    case 'last90': return subDays(now, 90)
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch financial summary for the current month.
 */
export async function fetchFinancialSummary(
  supabase: SupabaseClient
): Promise<FinancialSummary> {
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const { data: mtdOrders, error: mtdError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, carrier_pay')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)

  if (mtdError) throw mtdError

  const { data: mtdExpenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount')
    .gte('expense_date', monthStart.split('T')[0])
    .lte('expense_date', monthEnd.split('T')[0])

  if (expError) throw expError

  const { data: mtdTrips, error: tripError } = await supabase
    .from('trips')
    .select('driver_pay')
    .gte('start_date', monthStart.split('T')[0])
    .lte('start_date', monthEnd.split('T')[0])

  if (tripError) throw tripError

  let revenueMTD = 0
  let brokerFeesMTD = 0
  for (const o of mtdOrders ?? []) {
    revenueMTD += parseFloat(o.revenue ?? '0')
    brokerFeesMTD += parseFloat(o.broker_fee ?? '0')
  }

  let tripExpensesMTD = 0
  for (const e of mtdExpenses ?? []) {
    tripExpensesMTD += parseFloat(e.amount ?? '0')
  }

  let driverPayMTD = 0
  for (const t of mtdTrips ?? []) {
    driverPayMTD += parseFloat(t.driver_pay ?? '0')
  }

  const expensesMTD = brokerFeesMTD + tripExpensesMTD + driverPayMTD
  const netProfitMTD = revenueMTD - expensesMTD

  return {
    revenueMTD: Math.round(revenueMTD * 100) / 100,
    expensesMTD: Math.round(expensesMTD * 100) / 100,
    netProfitMTD: Math.round(netProfitMTD * 100) / 100,
  }
}

/**
 * Fetch revenue and expenses grouped by month for the last 6 months.
 */
export async function fetchRevenueByMonth(
  supabase: SupabaseClient
): Promise<MonthlyRevenue[]> {
  const now = new Date()
  const sixMonthsAgo = subMonths(startOfMonth(now), 5)

  const { data: orders, error: ordError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, created_at')
    .gte('created_at', sixMonthsAgo.toISOString())

  if (ordError) throw ordError

  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount, expense_date')
    .gte('expense_date', format(sixMonthsAgo, 'yyyy-MM-dd'))

  if (expError) throw expError

  const { data: trips, error: tripError } = await supabase
    .from('trips')
    .select('driver_pay, start_date')
    .gte('start_date', format(sixMonthsAgo, 'yyyy-MM-dd'))

  if (tripError) throw tripError

  const monthMap = new Map<string, MonthlyRevenue>()

  for (let i = 5; i >= 0; i--) {
    const m = subMonths(now, i)
    const key = format(m, 'yyyy-MM')
    monthMap.set(key, { month: format(m, 'MMM yyyy'), revenue: 0, expenses: 0 })
  }

  for (const o of orders ?? []) {
    const key = format(new Date(o.created_at), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.revenue += parseFloat(o.revenue ?? '0')
      entry.expenses += parseFloat(o.broker_fee ?? '0')
    }
  }

  for (const e of expenses ?? []) {
    if (!e.expense_date) continue
    const key = format(new Date(e.expense_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.expenses += parseFloat(e.amount ?? '0')
    }
  }

  for (const t of trips ?? []) {
    if (!t.start_date) continue
    const key = format(new Date(t.start_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.expenses += parseFloat(t.driver_pay ?? '0')
    }
  }

  const result = Array.from(monthMap.values())
  for (const entry of result) {
    entry.revenue = Math.round(entry.revenue * 100) / 100
    entry.expenses = Math.round(entry.expenses * 100) / 100
  }

  return result
}

/**
 * Fetch top 5 brokers by total revenue.
 */
export async function fetchTopBrokersByRevenue(
  supabase: SupabaseClient
): Promise<TopBroker[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('revenue, broker:brokers(id, name)')
    .not('broker_id', 'is', null)

  if (error) throw error

  const brokerMap = new Map<string, { name: string; totalRevenue: number; orderCount: number }>()

  for (const o of orders ?? []) {
    const brokerRaw = o.broker as unknown as { id: string; name: string } | { id: string; name: string }[] | null
    const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw
    if (!broker) continue

    if (!brokerMap.has(broker.id)) {
      brokerMap.set(broker.id, { name: broker.name, totalRevenue: 0, orderCount: 0 })
    }

    const entry = brokerMap.get(broker.id)!
    entry.totalRevenue += parseFloat(o.revenue ?? '0')
    entry.orderCount += 1
  }

  return Array.from(brokerMap.values())
    .map((b) => ({
      brokerName: b.name,
      totalRevenue: Math.round(b.totalRevenue * 100) / 100,
      orderCount: b.orderCount,
      avgOrderValue: b.orderCount > 0 ? Math.round((b.totalRevenue / b.orderCount) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely fetch distance_miles from orders. Returns empty array if column doesn't exist yet.
 */
async function safeFetchMiles(
  supabase: SupabaseClient,
  filter: { column: string; op: 'gte'; value: string }
): Promise<{ distance_miles: string; created_at?: string }[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('distance_miles, created_at')
      .gte(filter.column, filter.value)
      .not('distance_miles', 'is', null)

    if (error) return []
    return (data ?? []) as { distance_miles: string; created_at?: string }[]
  } catch {
    return []
  }
}

// ============================================================================
// New KPI Query Functions
// ============================================================================

/**
 * Fetch all aggregated KPI data for a given period.
 */
export async function fetchKPIAggregates(
  supabase: SupabaseClient,
  period: FinancialPeriod
): Promise<KPIAggregates> {
  const periodStart = getPeriodStart(period)
  const startISO = periodStart.toISOString()
  const startDate = format(periodStart, 'yyyy-MM-dd')

  // Parallel queries — distance_miles fetched separately to gracefully handle missing column
  const [ordersRes, milesData, tripsRes, expensesRes, trucksRes] = await Promise.all([
    supabase
      .from('orders')
      .select('revenue, broker_fee, carrier_pay')
      .gte('created_at', startISO),
    safeFetchMiles(supabase, { column: 'created_at', op: 'gte', value: startISO }),
    supabase
      .from('trips')
      .select('driver_pay, total_revenue, total_expenses, status')
      .gte('start_date', startDate),
    supabase
      .from('trip_expenses')
      .select('amount, category')
      .gte('expense_date', startDate),
    supabase
      .from('trucks')
      .select('id', { count: 'exact', head: true })
      .eq('truck_status', 'active'),
  ])

  if (ordersRes.error) throw ordersRes.error
  if (tripsRes.error) throw tripsRes.error
  if (expensesRes.error) throw expensesRes.error
  if (trucksRes.error) throw trucksRes.error

  const orders = ordersRes.data ?? []
  const trips = tripsRes.data ?? []
  const expenses = expensesRes.data ?? []

  let totalRevenue = 0
  let totalBrokerFees = 0
  let totalCarrierPay = 0
  for (const o of orders) {
    totalRevenue += parseFloat(o.revenue ?? '0')
    totalBrokerFees += parseFloat(o.broker_fee ?? '0')
    totalCarrierPay += parseFloat(o.carrier_pay ?? '0')
  }

  // Miles from separate query (gracefully 0 if column doesn't exist yet)
  let totalMiles = 0
  for (const o of milesData) {
    totalMiles += parseFloat(o.distance_miles ?? '0')
  }

  let totalDriverPay = 0
  let completedTripCount = 0
  for (const t of trips) {
    totalDriverPay += parseFloat(t.driver_pay ?? '0')
    if (t.status === 'completed') completedTripCount++
  }

  const expensesByCategory = { fuel: 0, tolls: 0, repairs: 0, lodging: 0, misc: 0 }
  let totalTripExpenses = 0
  for (const e of expenses) {
    const amount = parseFloat(e.amount ?? '0')
    totalTripExpenses += amount
    const cat = e.category as keyof typeof expensesByCategory
    if (cat in expensesByCategory) {
      expensesByCategory[cat] += amount
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalBrokerFees: Math.round(totalBrokerFees * 100) / 100,
    totalDriverPay: Math.round(totalDriverPay * 100) / 100,
    totalTripExpenses: Math.round(totalTripExpenses * 100) / 100,
    totalCarrierPay: Math.round(totalCarrierPay * 100) / 100,
    totalMiles: Math.round(totalMiles * 10) / 10,
    orderCount: orders.length,
    truckCount: trucksRes.count ?? 0,
    completedTripCount,
    expensesByCategory: {
      fuel: Math.round(expensesByCategory.fuel * 100) / 100,
      tolls: Math.round(expensesByCategory.tolls * 100) / 100,
      repairs: Math.round(expensesByCategory.repairs * 100) / 100,
      lodging: Math.round(expensesByCategory.lodging * 100) / 100,
      misc: Math.round(expensesByCategory.misc * 100) / 100,
    },
  }
}

/**
 * Fetch profit aggregated by truck for a given period.
 */
export async function fetchProfitByTruck(
  supabase: SupabaseClient,
  period: FinancialPeriod
): Promise<ProfitByTruck[]> {
  const startDate = format(getPeriodStart(period), 'yyyy-MM-dd')

  const { data: trips, error } = await supabase
    .from('trips')
    .select('truck_id, total_revenue, total_broker_fees, driver_pay, total_expenses, carrier_pay, truck:trucks(id, unit_number)')
    .gte('start_date', startDate)

  if (error) throw error

  // Also fetch order miles per trip
  const tripIds = (trips ?? []).map((t) => t.truck_id).filter(Boolean)

  const truckMap = new Map<string, ProfitByTruck>()

  for (const t of trips ?? []) {
    const truckRaw = t.truck as unknown as { id: string; unit_number: string } | { id: string; unit_number: string }[] | null
    const truck = Array.isArray(truckRaw) ? truckRaw[0] ?? null : truckRaw
    if (!truck) continue

    if (!truckMap.has(truck.id)) {
      truckMap.set(truck.id, {
        truckId: truck.id,
        unitNumber: truck.unit_number,
        revenue: 0,
        expenses: 0,
        profit: 0,
        margin: 0,
        tripCount: 0,
        miles: 0,
      })
    }

    const entry = truckMap.get(truck.id)!
    const revenue = parseFloat(t.total_revenue ?? '0')
    const brokerFees = parseFloat(t.total_broker_fees ?? '0')
    const driverPay = parseFloat(t.driver_pay ?? '0')
    const tripExpenses = parseFloat(t.total_expenses ?? '0')
    const carrierPay = parseFloat(t.carrier_pay ?? '0')
    const expenses = brokerFees + driverPay + tripExpenses + carrierPay

    entry.revenue += revenue
    entry.expenses += expenses
    entry.tripCount += 1
  }

  // Calculate profit and margin
  for (const entry of truckMap.values()) {
    entry.profit = Math.round((entry.revenue - entry.expenses) * 100) / 100
    entry.revenue = Math.round(entry.revenue * 100) / 100
    entry.expenses = Math.round(entry.expenses * 100) / 100
    entry.margin = entry.revenue > 0 ? Math.round((entry.profit / entry.revenue) * 10000) / 100 : 0
  }

  return Array.from(truckMap.values()).sort((a, b) => b.profit - a.profit)
}

/**
 * Fetch profit aggregated by driver for a given period.
 */
export async function fetchProfitByDriver(
  supabase: SupabaseClient,
  period: FinancialPeriod
): Promise<ProfitByDriver[]> {
  const startDate = format(getPeriodStart(period), 'yyyy-MM-dd')

  const { data: trips, error } = await supabase
    .from('trips')
    .select('driver_id, total_revenue, driver_pay, driver:drivers(id, first_name, last_name, driver_type)')
    .gte('start_date', startDate)

  if (error) throw error

  const driverMap = new Map<string, ProfitByDriver>()

  for (const t of trips ?? []) {
    const driverRaw = t.driver as unknown as { id: string; first_name: string; last_name: string; driver_type: string } | { id: string; first_name: string; last_name: string; driver_type: string }[] | null
    const driver = Array.isArray(driverRaw) ? driverRaw[0] ?? null : driverRaw
    if (!driver) continue

    if (!driverMap.has(driver.id)) {
      driverMap.set(driver.id, {
        driverId: driver.id,
        name: `${driver.first_name} ${driver.last_name}`,
        driverType: driver.driver_type,
        revenue: 0,
        driverPay: 0,
        tripCount: 0,
        profitMargin: 0,
      })
    }

    const entry = driverMap.get(driver.id)!
    entry.revenue += parseFloat(t.total_revenue ?? '0')
    entry.driverPay += parseFloat(t.driver_pay ?? '0')
    entry.tripCount += 1
  }

  for (const entry of driverMap.values()) {
    entry.revenue = Math.round(entry.revenue * 100) / 100
    entry.driverPay = Math.round(entry.driverPay * 100) / 100
    entry.profitMargin = entry.revenue > 0
      ? Math.round(((entry.revenue - entry.driverPay) / entry.revenue) * 10000) / 100
      : 0
  }

  return Array.from(driverMap.values()).sort((a, b) => b.revenue - a.revenue)
}

/**
 * Fetch monthly KPI trend data for the last N months.
 */
export async function fetchMonthlyKPITrend(
  supabase: SupabaseClient,
  months: number = 6
): Promise<MonthlyKPITrend[]> {
  const now = new Date()
  const startFrom = subMonths(startOfMonth(now), months - 1)

  const [ordersRes, trendMilesData, tripsRes, expensesRes] = await Promise.all([
    supabase
      .from('orders')
      .select('revenue, broker_fee, carrier_pay, created_at')
      .gte('created_at', startFrom.toISOString()),
    safeFetchMiles(supabase, { column: 'created_at', op: 'gte', value: startFrom.toISOString() }),
    supabase
      .from('trips')
      .select('driver_pay, start_date')
      .gte('start_date', format(startFrom, 'yyyy-MM-dd')),
    supabase
      .from('trip_expenses')
      .select('amount, expense_date')
      .gte('expense_date', format(startFrom, 'yyyy-MM-dd')),
  ])

  if (ordersRes.error) throw ordersRes.error
  if (tripsRes.error) throw tripsRes.error
  if (expensesRes.error) throw expensesRes.error

  // Initialize monthly buckets
  const monthMap = new Map<string, { label: string; revenue: number; brokerFees: number; carrierPay: number; driverPay: number; tripExpenses: number; miles: number }>()

  for (let i = months - 1; i >= 0; i--) {
    const m = subMonths(now, i)
    const key = format(m, 'yyyy-MM')
    monthMap.set(key, { label: format(m, 'MMM yyyy'), revenue: 0, brokerFees: 0, carrierPay: 0, driverPay: 0, tripExpenses: 0, miles: 0 })
  }

  for (const o of ordersRes.data ?? []) {
    const key = format(new Date(o.created_at), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.revenue += parseFloat(o.revenue ?? '0')
      entry.brokerFees += parseFloat(o.broker_fee ?? '0')
      entry.carrierPay += parseFloat(o.carrier_pay ?? '0')
    }
  }

  // Miles from separate query (gracefully 0 if column doesn't exist yet)
  for (const o of trendMilesData) {
    if (!o.created_at) continue
    const key = format(new Date(o.created_at), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.miles += parseFloat(o.distance_miles ?? '0')
    }
  }

  for (const t of tripsRes.data ?? []) {
    if (!t.start_date) continue
    const key = format(new Date(t.start_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.driverPay += parseFloat(t.driver_pay ?? '0')
    }
  }

  for (const e of expensesRes.data ?? []) {
    if (!e.expense_date) continue
    const key = format(new Date(e.expense_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.tripExpenses += parseFloat(e.amount ?? '0')
    }
  }

  return Array.from(monthMap.values()).map((m) => {
    const totalExpenses = m.brokerFees + m.driverPay + m.tripExpenses + m.carrierPay
    const netProfit = m.revenue - totalExpenses
    const hasMiles = m.miles > 0

    return {
      month: m.label,
      revenue: Math.round(m.revenue * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      miles: Math.round(m.miles * 10) / 10,
      rpm: hasMiles ? Math.round((m.revenue / m.miles) * 100) / 100 : null,
      cpm: hasMiles ? Math.round((totalExpenses / m.miles) * 100) / 100 : null,
      ppm: hasMiles ? Math.round((netProfit / m.miles) * 100) / 100 : null,
      grossMargin: m.revenue > 0 ? Math.round(((m.revenue - m.brokerFees - m.driverPay) / m.revenue) * 10000) / 100 : 0,
      netMargin: m.revenue > 0 ? Math.round((netProfit / m.revenue) * 10000) / 100 : 0,
      operatingRatio: m.revenue > 0 ? Math.round((totalExpenses / m.revenue) * 10000) / 100 : 0,
    }
  })
}
