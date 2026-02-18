'use server'

import { authorize, safeError } from '@/lib/authz'
import { logOrderActivity } from '@/lib/activity-log'
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

  // Update order status — no payment recorded yet (factoring company pays later)
  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_status: 'factored',
      invoice_date: now,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'factorOrder:update') }
  }

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'order_factored',
    description: `Order factored at ${feeRate}% — Fee: $${factoringFee.toFixed(2)}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { feeRate, factoringFee, netAmount },
  }).catch(() => {})

  revalidatePath('/billing')
  revalidatePath(`/orders/${orderId}`)
  return {
    success: true,
    data: { factoringFee, netAmount, feeRate },
  }
}
