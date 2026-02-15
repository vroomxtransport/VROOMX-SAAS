import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

export interface FinancialSummary {
  revenueMTD: number
  expensesMTD: number
  netProfitMTD: number
  outstandingReceivables: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
  expenses: number
}

export interface PaymentStatusBreakdown {
  status: string
  count: number
  amount: number
}

export interface TopBroker {
  brokerName: string
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
}

export interface RecentPayment {
  orderNumber: string
  amount: number
  paymentDate: string
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch financial summary for the current month.
 * Computes revenue MTD, expenses MTD, net profit MTD, and outstanding receivables.
 */
export async function fetchFinancialSummary(
  supabase: SupabaseClient
): Promise<FinancialSummary> {
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  // Fetch orders for the current month
  const { data: mtdOrders, error: mtdError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, carrier_pay')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)

  if (mtdError) throw mtdError

  // Fetch trip expenses for current month
  const { data: mtdExpenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount')
    .gte('expense_date', monthStart.split('T')[0])
    .lte('expense_date', monthEnd.split('T')[0])

  if (expError) throw expError

  // Fetch trips for current month (for driver pay)
  const { data: mtdTrips, error: tripError } = await supabase
    .from('trips')
    .select('driver_pay')
    .gte('start_date', monthStart.split('T')[0])
    .lte('start_date', monthEnd.split('T')[0])

  if (tripError) throw tripError

  // Fetch outstanding receivables (invoiced or partially paid)
  const { data: arOrders, error: arError } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid')
    .in('payment_status', ['invoiced', 'partially_paid'])

  if (arError) throw arError

  // Compute MTD revenue
  let revenueMTD = 0
  let brokerFeesMTD = 0
  for (const o of mtdOrders ?? []) {
    revenueMTD += parseFloat(o.revenue ?? '0')
    brokerFeesMTD += parseFloat(o.broker_fee ?? '0')
  }

  // Compute MTD trip expenses
  let tripExpensesMTD = 0
  for (const e of mtdExpenses ?? []) {
    tripExpensesMTD += parseFloat(e.amount ?? '0')
  }

  // Compute MTD driver pay
  let driverPayMTD = 0
  for (const t of mtdTrips ?? []) {
    driverPayMTD += parseFloat(t.driver_pay ?? '0')
  }

  const expensesMTD = brokerFeesMTD + tripExpensesMTD + driverPayMTD
  const netProfitMTD = revenueMTD - expensesMTD

  // Compute outstanding receivables
  let outstandingReceivables = 0
  for (const o of arOrders ?? []) {
    outstandingReceivables += parseFloat(o.carrier_pay ?? '0') - parseFloat(o.amount_paid ?? '0')
  }

  return {
    revenueMTD: Math.round(revenueMTD * 100) / 100,
    expensesMTD: Math.round(expensesMTD * 100) / 100,
    netProfitMTD: Math.round(netProfitMTD * 100) / 100,
    outstandingReceivables: Math.round(outstandingReceivables * 100) / 100,
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

  // Fetch orders from last 6 months
  const { data: orders, error: ordError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, created_at')
    .gte('created_at', sixMonthsAgo.toISOString())

  if (ordError) throw ordError

  // Fetch trip expenses for same period
  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount, expense_date')
    .gte('expense_date', format(sixMonthsAgo, 'yyyy-MM-dd'))

  if (expError) throw expError

  // Fetch trips for driver pay
  const { data: trips, error: tripError } = await supabase
    .from('trips')
    .select('driver_pay, start_date')
    .gte('start_date', format(sixMonthsAgo, 'yyyy-MM-dd'))

  if (tripError) throw tripError

  // Build monthly map
  const monthMap = new Map<string, MonthlyRevenue>()

  // Initialize all 6 months
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(now, i)
    const key = format(m, 'yyyy-MM')
    monthMap.set(key, { month: format(m, 'MMM yyyy'), revenue: 0, expenses: 0 })
  }

  // Aggregate orders
  for (const o of orders ?? []) {
    const key = format(new Date(o.created_at), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.revenue += parseFloat(o.revenue ?? '0')
      entry.expenses += parseFloat(o.broker_fee ?? '0')
    }
  }

  // Add trip expenses
  for (const e of expenses ?? []) {
    if (!e.expense_date) continue
    const key = format(new Date(e.expense_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.expenses += parseFloat(e.amount ?? '0')
    }
  }

  // Add driver pay from trips
  for (const t of trips ?? []) {
    if (!t.start_date) continue
    const key = format(new Date(t.start_date), 'yyyy-MM')
    const entry = monthMap.get(key)
    if (entry) {
      entry.expenses += parseFloat(t.driver_pay ?? '0')
    }
  }

  // Round values
  const result = Array.from(monthMap.values())
  for (const entry of result) {
    entry.revenue = Math.round(entry.revenue * 100) / 100
    entry.expenses = Math.round(entry.expenses * 100) / 100
  }

  return result
}

/**
 * Fetch payment status breakdown: count and total amount per status.
 */
export async function fetchPaymentStatusBreakdown(
  supabase: SupabaseClient
): Promise<PaymentStatusBreakdown[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('payment_status, carrier_pay')

  if (error) throw error

  const statusMap = new Map<string, { count: number; amount: number }>()

  for (const o of orders ?? []) {
    const status = o.payment_status ?? 'unpaid'
    if (!statusMap.has(status)) {
      statusMap.set(status, { count: 0, amount: 0 })
    }
    const entry = statusMap.get(status)!
    entry.count += 1
    entry.amount += parseFloat(o.carrier_pay ?? '0')
  }

  return Array.from(statusMap.entries()).map(([status, data]) => ({
    status,
    count: data.count,
    amount: Math.round(data.amount * 100) / 100,
  }))
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

/**
 * Fetch the 10 most recent payments with associated order number.
 */
export async function fetchRecentPayments(
  supabase: SupabaseClient
): Promise<RecentPayment[]> {
  const { data: paymentsData, error } = await supabase
    .from('payments')
    .select('amount, payment_date, order:orders(order_number)')
    .order('payment_date', { ascending: false })
    .limit(10)

  if (error) throw error

  return (paymentsData ?? []).map((p) => {
    const orderRaw = p.order as unknown as { order_number: string | null } | { order_number: string | null }[] | null
    const order = Array.isArray(orderRaw) ? orderRaw[0] ?? null : orderRaw
    return {
      orderNumber: order?.order_number ?? 'N/A',
      amount: parseFloat(p.amount ?? '0'),
      paymentDate: p.payment_date,
    }
  })
}
