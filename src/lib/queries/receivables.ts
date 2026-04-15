import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns'

/**
 * Audit W2-4 defense-in-depth: every receivables query below now adds an
 * explicit `.eq('tenant_id', tenantId)` filter in addition to RLS. RLS is
 * the authoritative tenant gate; this filter prevents silent data leaks
 * if RLS is ever misconfigured or disabled in a migration.
 *
 * Fetches the caller's tenant_id from the session (JWT app_metadata).
 * Returns null if there is no valid session — callers should short-circuit
 * with empty results rather than throw.
 */
async function getSessionTenantId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return (user?.app_metadata?.tenant_id as string | undefined) ?? null
}

// ============================================================================
// Types
// ============================================================================

export interface PaymentStatusBreakdown {
  status: string
  count: number
  amount: number
}

export interface RecentPayment {
  orderNumber: string
  amount: number
  paymentDate: string
}

export interface BrokerReceivable {
  brokerId: string
  brokerName: string
  brokerEmail: string | null
  totalOwed: number
  invoiceCount: number
  oldestUnpaid: string | null
  paidThisMonth: number
  overdueAmount: number
  orders: Array<{
    id: string
    orderNumber: string | null
    carrierPay: number
    amountPaid: number
    paymentStatus: string
    invoiceDate: string | null
  }>
}

export type AgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '90_plus'

export interface AgingRow {
  brokerId: string
  brokerName: string
  current: number
  '1_30': number
  '31_60': number
  '61_90': number
  '90_plus': number
  total: number
}

export interface CollectionRate {
  totalInvoiced: number
  totalCollected: number
  rate: number
}

// ============================================================================
// Helpers
// ============================================================================

function getAgingBucket(invoiceDate: string): AgingBucket {
  const days = differenceInDays(new Date(), new Date(invoiceDate))
  if (days <= 0) return 'current'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch receivables grouped by broker.
 * Returns per-broker aggregation of outstanding invoices with totals.
 */
export async function fetchBrokerReceivables(
  supabase: SupabaseClient
): Promise<BrokerReceivable[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []

  // Fetch all orders with outstanding payment status that have a broker
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, broker_id, carrier_pay, amount_paid, payment_status, invoice_date, payment_type, cod_amount, billing_amount, broker:brokers(id, name, email)'
    )
    .eq('tenant_id', tenantId)
    .in('payment_status', ['invoiced', 'partially_paid'])
    .not('broker_id', 'is', null)

  if (error) throw error

  // Fetch payments made this month for paid-this-month calculation
  const now = new Date()
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const { data: recentPayments, error: paymentsError } = await supabase
    .from('payments')
    .select('order_id, amount')
    .eq('tenant_id', tenantId)
    .gte('payment_date', monthStart.split('T')[0])
    .lte('payment_date', monthEnd.split('T')[0])

  if (paymentsError) throw paymentsError

  // Build a map of order_id -> payments this month
  const monthlyPaymentsByOrder = new Map<string, number>()
  for (const p of recentPayments ?? []) {
    const current = monthlyPaymentsByOrder.get(p.order_id) ?? 0
    monthlyPaymentsByOrder.set(p.order_id, current + parseFloat(p.amount))
  }

  // Group by broker
  const brokerMap = new Map<string, BrokerReceivable>()

  for (const order of orders ?? []) {
    const brokerRaw = order.broker as unknown as { id: string; name: string; email: string | null } | { id: string; name: string; email: string | null }[] | null
    const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw
    if (!broker) continue

    const carrierPay = parseFloat(order.carrier_pay)
    const amountPaid = parseFloat(order.amount_paid)

    // For SPLIT orders: outstanding = billing_amount - (amount_paid - cod_amount)
    // COD portion is NOT part of receivables (collected at delivery, not billed)
    const isSplit = order.payment_type === 'SPLIT' && order.billing_amount !== null
    const codAmount = isSplit && order.cod_amount ? parseFloat(order.cod_amount) : 0
    const billingAmount = isSplit ? parseFloat(order.billing_amount!) : carrierPay
    const billingPaid = isSplit ? Math.max(0, amountPaid - codAmount) : amountPaid
    const remaining = billingAmount - billingPaid

    if (!brokerMap.has(broker.id)) {
      brokerMap.set(broker.id, {
        brokerId: broker.id,
        brokerName: broker.name,
        brokerEmail: broker.email,
        totalOwed: 0,
        invoiceCount: 0,
        oldestUnpaid: null,
        paidThisMonth: 0,
        overdueAmount: 0,
        orders: [],
      })
    }

    const entry = brokerMap.get(broker.id)!

    entry.totalOwed += remaining
    entry.invoiceCount += 1

    // Track oldest unpaid by invoice_date
    if (order.invoice_date) {
      if (!entry.oldestUnpaid || order.invoice_date < entry.oldestUnpaid) {
        entry.oldestUnpaid = order.invoice_date
      }

      // Overdue: invoiced more than 30 days ago
      const daysSinceInvoice = differenceInDays(new Date(), new Date(order.invoice_date))
      if (daysSinceInvoice > 30) {
        entry.overdueAmount += remaining
      }
    }

    // Paid this month from the payments query
    const monthlyForOrder = monthlyPaymentsByOrder.get(order.id) ?? 0
    entry.paidThisMonth += monthlyForOrder

    entry.orders.push({
      id: order.id,
      orderNumber: order.order_number,
      carrierPay,
      amountPaid,
      paymentStatus: order.payment_status,
      invoiceDate: order.invoice_date,
    })
  }

  // Sort by totalOwed descending
  return Array.from(brokerMap.values()).sort((a, b) => b.totalOwed - a.totalOwed)
}

/**
 * Fetch aging analysis: bucket outstanding amounts by invoice age per broker.
 * Buckets: Current (0 days), 1-30, 31-60, 61-90, 90+ days from invoice_date.
 */
export async function fetchAgingAnalysis(
  supabase: SupabaseClient
): Promise<AgingRow[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, broker_id, carrier_pay, amount_paid, invoice_date, broker:brokers(id, name)'
    )
    .eq('tenant_id', tenantId)
    .in('payment_status', ['invoiced', 'partially_paid'])
    .not('invoice_date', 'is', null)

  if (error) throw error

  const brokerMap = new Map<string, AgingRow>()

  for (const order of orders ?? []) {
    const brokerRaw = order.broker as unknown as { id: string; name: string } | { id: string; name: string }[] | null
    const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw
    if (!broker || !order.invoice_date) continue

    const remaining = parseFloat(order.carrier_pay) - parseFloat(order.amount_paid)
    if (remaining <= 0) continue

    const bucket = getAgingBucket(order.invoice_date)

    if (!brokerMap.has(broker.id)) {
      brokerMap.set(broker.id, {
        brokerId: broker.id,
        brokerName: broker.name,
        current: 0,
        '1_30': 0,
        '31_60': 0,
        '61_90': 0,
        '90_plus': 0,
        total: 0,
      })
    }

    const row = brokerMap.get(broker.id)!
    row[bucket] += remaining
    row.total += remaining
  }

  // Sort by total descending
  return Array.from(brokerMap.values()).sort((a, b) => b.total - a.total)
}

/**
 * Fetch collection rate: percentage of invoiced amount that has been collected.
 */
export async function fetchCollectionRate(
  supabase: SupabaseClient
): Promise<CollectionRate> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return { totalInvoiced: 0, totalCollected: 0, rate: 0 }
  // Fetch all orders that have been invoiced at any point
  // (payment_status is invoiced, partially_paid, or paid means it was invoiced)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid')
    .eq('tenant_id', tenantId)
    .in('payment_status', ['invoiced', 'partially_paid', 'paid'])

  if (error) throw error

  let totalInvoiced = 0
  let totalCollected = 0

  for (const order of orders ?? []) {
    totalInvoiced += parseFloat(order.carrier_pay)
    totalCollected += parseFloat(order.amount_paid)
  }

  const rate = totalInvoiced > 0
    ? Math.round((totalCollected / totalInvoiced) * 10000) / 100
    : 0

  return {
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    rate,
  }
}

// ============================================================================
// Orders by Payment Status — for clickable status cards
// ============================================================================

export interface StatusOrder {
  id: string
  orderNumber: string | null
  vehicleName: string
  brokerName: string | null
  carrierPay: number
  amountPaid: number
  updatedAt: string
}

export async function fetchOrdersByPaymentStatus(
  supabase: SupabaseClient,
  status: string
): Promise<StatusOrder[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, vehicle_year, vehicle_make, vehicle_model, carrier_pay, amount_paid, updated_at, broker:brokers(name)'
    )
    .eq('tenant_id', tenantId)
    .eq('payment_status', status)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return (orders ?? []).map((o) => {
    const brokerRaw = o.broker as unknown as { name: string } | { name: string }[] | null
    const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw

    const vehicleName = [o.vehicle_year, o.vehicle_make, o.vehicle_model]
      .filter(Boolean)
      .join(' ') || 'Unknown Vehicle'

    return {
      id: o.id,
      orderNumber: o.order_number,
      vehicleName,
      brokerName: broker?.name ?? null,
      carrierPay: parseFloat(o.carrier_pay ?? '0'),
      amountPaid: parseFloat(o.amount_paid ?? '0'),
      updatedAt: o.updated_at,
    }
  })
}

// ============================================================================
// Ready to Invoice — Delivered orders not yet invoiced
// ============================================================================

export interface ReadyToInvoiceOrder {
  id: string
  orderNumber: string | null
  vehicleName: string
  carrierPay: number
  /** The amount that should appear on the invoice. For SPLIT orders this is billing_amount, otherwise carrier_pay. */
  invoiceableAmount: number
  route: string
  updatedAt: string
  broker: { id: string; name: string; email: string | null } | null
  paymentType: 'COD' | 'COP' | 'CHECK' | 'BILL' | 'SPLIT' | null
  codAmount: number | null
  billingAmount: number | null
}

export async function fetchReadyToInvoice(
  supabase: SupabaseClient
): Promise<ReadyToInvoiceOrder[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, vehicle_year, vehicle_make, vehicle_model, carrier_pay, pickup_city, pickup_state, delivery_city, delivery_state, updated_at, payment_type, cod_amount, billing_amount, broker:brokers(id, name, email)'
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'delivered')
    .eq('payment_status', 'unpaid')
    .order('updated_at', { ascending: true })

  if (error) throw error

  return (orders ?? []).map((o) => {
    const brokerRaw = o.broker as unknown as { id: string; name: string; email: string | null } | { id: string; name: string; email: string | null }[] | null
    const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw

    const vehicleName = [o.vehicle_year, o.vehicle_make, o.vehicle_model]
      .filter(Boolean)
      .join(' ') || 'Unknown Vehicle'

    const route = [
      o.pickup_city && o.pickup_state ? `${o.pickup_city}, ${o.pickup_state}` : null,
      o.delivery_city && o.delivery_state ? `${o.delivery_city}, ${o.delivery_state}` : null,
    ]
      .filter(Boolean)
      .join(' \u2192 ') || 'No route'

    const carrierPay = parseFloat(o.carrier_pay)
    const orderPaymentType = (o as Record<string, unknown>).payment_type as ReadyToInvoiceOrder['paymentType']
    const orderBillingAmount = (o as Record<string, unknown>).billing_amount ? parseFloat((o as Record<string, unknown>).billing_amount as string) : null
    const orderCodAmount = (o as Record<string, unknown>).cod_amount ? parseFloat((o as Record<string, unknown>).cod_amount as string) : null

    // For SPLIT orders, the invoiceable amount is billing_amount (not carrier_pay)
    const invoiceableAmount = orderPaymentType === 'SPLIT' && orderBillingAmount !== null
      ? orderBillingAmount
      : carrierPay

    return {
      id: o.id,
      orderNumber: o.order_number,
      vehicleName,
      carrierPay,
      invoiceableAmount,
      route,
      updatedAt: o.updated_at,
      broker,
      paymentType: orderPaymentType,
      codAmount: orderCodAmount,
      billingAmount: orderBillingAmount,
    }
  })
}

// ============================================================================
// Payment / AR Query Functions (moved from financials)
// ============================================================================

/**
 * Fetch payment status breakdown.
 */
export async function fetchPaymentStatusBreakdown(
  supabase: SupabaseClient
): Promise<PaymentStatusBreakdown[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []
  const { data: orders, error } = await supabase
    .from('orders')
    .select('payment_status, carrier_pay')
    .eq('tenant_id', tenantId)

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
 * Fetch the 10 most recent payments.
 */
export async function fetchRecentPayments(
  supabase: SupabaseClient
): Promise<RecentPayment[]> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return []
  const { data: paymentsData, error } = await supabase
    .from('payments')
    .select('amount, payment_date, order:orders(order_number)')
    .eq('tenant_id', tenantId)
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

/**
 * Fetch total outstanding AR (invoiced + partially_paid orders, SUM of carrier_pay - amount_paid).
 */
export async function fetchOutstandingAR(
  supabase: SupabaseClient
): Promise<number> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return 0
  const { data: orders, error } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid')
    .eq('tenant_id', tenantId)
    .in('payment_status', ['invoiced', 'partially_paid'])

  if (error) throw error

  let total = 0
  for (const o of orders ?? []) {
    total += parseFloat(o.carrier_pay ?? '0') - parseFloat(o.amount_paid ?? '0')
  }

  return Math.round(total * 100) / 100
}

/**
 * Fetch total carrier_pay for orders invoiced this month.
 */
export async function fetchInvoicedMTD(
  supabase: SupabaseClient
): Promise<number> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return 0

  const now = new Date()
  const monthStart = startOfMonth(now).toISOString().split('T')[0]
  const monthEnd = endOfMonth(now).toISOString().split('T')[0]

  const { data: orders, error } = await supabase
    .from('orders')
    .select('carrier_pay')
    .eq('tenant_id', tenantId)
    .not('invoice_date', 'is', null)
    .gte('invoice_date', monthStart)
    .lte('invoice_date', monthEnd)

  if (error) throw error

  let total = 0
  for (const o of orders ?? []) {
    total += parseFloat(o.carrier_pay ?? '0')
  }

  return Math.round(total * 100) / 100
}

/**
 * Fetch total payment amount collected this month.
 */
export async function fetchCollectedMTD(
  supabase: SupabaseClient
): Promise<number> {
  const tenantId = await getSessionTenantId(supabase)
  if (!tenantId) return 0

  const now = new Date()
  const monthStart = startOfMonth(now).toISOString().split('T')[0]
  const monthEnd = endOfMonth(now).toISOString().split('T')[0]

  const { data: payments, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  if (error) throw error

  let total = 0
  for (const p of payments ?? []) {
    total += parseFloat(p.amount ?? '0')
  }

  return Math.round(total * 100) / 100
}
