import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInDays, startOfMonth, endOfMonth } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

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
  // Fetch all orders with outstanding payment status that have a broker
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, broker_id, carrier_pay, amount_paid, payment_status, invoice_date, broker:brokers(id, name, email)'
    )
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
    const remaining = carrierPay - amountPaid

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
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, broker_id, carrier_pay, amount_paid, invoice_date, broker:brokers(id, name)'
    )
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
  // Fetch all orders that have been invoiced at any point
  // (payment_status is invoiced, partially_paid, or paid means it was invoiced)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid')
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
// Ready to Invoice — Delivered orders not yet invoiced
// ============================================================================

export interface ReadyToInvoiceOrder {
  id: string
  orderNumber: string | null
  vehicleName: string
  carrierPay: number
  route: string
  updatedAt: string
  broker: { id: string; name: string; email: string | null } | null
}

export async function fetchReadyToInvoice(
  supabase: SupabaseClient
): Promise<ReadyToInvoiceOrder[]> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, vehicle_year, vehicle_make, vehicle_model, carrier_pay, pickup_city, pickup_state, delivery_city, delivery_state, updated_at, broker:brokers(id, name, email)'
    )
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

    return {
      id: o.id,
      orderNumber: o.order_number,
      vehicleName,
      carrierPay: parseFloat(o.carrier_pay),
      route,
      updatedAt: o.updated_at,
      broker,
    }
  })
}
