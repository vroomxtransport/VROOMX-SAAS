'use server'

import { authorize, safeError } from '@/lib/authz'
import { revalidatePath } from 'next/cache'

export async function factorOrder(orderId: string) {
  if (!orderId) return { error: 'Order ID is required' }

  const auth = await authorize('orders.update', {
    rateLimit: { key: 'factorOrder', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch tenant factoring fee rate
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('factoring_fee_rate')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    return { error: safeError(tenantError, 'factorOrder:tenant') }
  }

  const feeRate = parseFloat(tenant.factoring_fee_rate ?? '0')
  if (feeRate <= 0) {
    return { error: 'Factoring fee rate is not configured. Set it in Settings.' }
  }

  // Fetch order — validate ownership and eligibility
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, carrier_pay, amount_paid, payment_status, status')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return { error: safeError(orderError, 'factorOrder:order') }
  }

  if (order.payment_status !== 'unpaid') {
    return { error: 'Only unpaid orders can be factored' }
  }

  if (order.status !== 'delivered') {
    return { error: 'Only delivered orders can be factored' }
  }

  const carrierPay = parseFloat(order.carrier_pay)
  const factoringFee = Math.round(carrierPay * (feeRate / 100) * 100) / 100
  const netAmount = Math.round((carrierPay - factoringFee) * 100) / 100

  // Update order status and record payment
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: 'factored',
      amount_paid: String(netAmount),
      invoice_date: now,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'factorOrder:update') }
  }

  // Insert payment record
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      amount: String(netAmount),
      payment_date: now.split('T')[0],
      notes: `Factored at ${feeRate}% — Fee: $${factoringFee.toFixed(2)}`,
    })

  if (paymentError) {
    return { error: safeError(paymentError, 'factorOrder:payment') }
  }

  revalidatePath('/billing')
  revalidatePath(`/orders/${orderId}`)
  return {
    success: true,
    data: { factoringFee, netAmount, feeRate },
  }
}
