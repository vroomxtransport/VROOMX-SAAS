'use server'

import { authorize, safeError } from '@/lib/authz'
import { recordPaymentSchema } from '@/lib/validations/payment'
import { logOrderActivity } from '@/lib/activity-log'
import { notifyAssignedTeamForPaymentRecorded } from '@/lib/notifications/load-events'
import { syncPaymentToQB } from '@/lib/quickbooks/sync'
import { revalidatePath } from 'next/cache'

export async function recordPayment(orderId: string, data: unknown) {
  const parsed = recordPaymentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('payments.create', { rateLimit: { key: 'recordPayment', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch the order to get current carrier_pay, amount_paid, and SPLIT fields
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('order_number, carrier_pay, amount_paid, payment_status, payment_type, billing_amount, cod_amount')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Order not found' }
  }

  const carrierPay = parseFloat(order.carrier_pay)
  const currentPaid = parseFloat(order.amount_paid)

  // For SPLIT orders, the billable amount is billing_amount (COD is collected separately)
  const isSplit = order.payment_type === 'SPLIT' && order.billing_amount !== null
  const billingAmount = isSplit ? parseFloat(order.billing_amount!) : carrierPay
  const codAmount = isSplit && order.cod_amount ? parseFloat(order.cod_amount) : 0

  // For SPLIT orders, the billing remaining is billing_amount minus (amount_paid - cod_amount already collected)
  // For non-SPLIT orders, remaining is carrierPay - currentPaid
  const billingPaid = isSplit ? Math.max(0, currentPaid - codAmount) : currentPaid
  const remaining = billingAmount - billingPaid

  // Validate: payment amount must not exceed remaining balance (with threshold)
  if (parsed.data.amount > remaining + 0.01) {
    return { error: 'Payment amount exceeds remaining balance' }
  }

  // Insert payment into payments table
  const { data: payment, error: insertError } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      amount: String(parsed.data.amount),
      payment_date: parsed.data.paymentDate,
      notes: parsed.data.notes || null,
    })
    .select()
    .single()

  if (insertError) {
    return { error: safeError(insertError, 'recordPayment') }
  }

  // Calculate new total paid
  const newTotalPaid = currentPaid + parsed.data.amount

  // Determine new payment_status
  // For SPLIT orders: fully paid means total amount_paid >= carrier_pay (both COD + billing covered)
  let newPaymentStatus: string
  if (Math.abs(carrierPay - newTotalPaid) < 0.01 || newTotalPaid >= carrierPay) {
    newPaymentStatus = 'paid'
  } else if (newTotalPaid > 0) {
    newPaymentStatus = 'partially_paid'
  } else {
    newPaymentStatus = order.payment_status
  }

  // Update order with new amount_paid and payment_status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      amount_paid: String(Math.round(newTotalPaid * 100) / 100),
      payment_status: newPaymentStatus,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'recordPayment') }
  }

  // Fire-and-forget: sync payment to QuickBooks
  void syncPaymentToQB(supabase, tenantId, orderId, parsed.data.amount, parsed.data.paymentDate).catch(() => {})

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'payment_recorded',
    description: `Payment of $${parsed.data.amount.toFixed(2)} recorded`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { amount: parsed.data.amount, paymentDate: parsed.data.paymentDate, newPaymentStatus },
  }).catch(() => {})

  void notifyAssignedTeamForPaymentRecorded({
    supabase,
    tenantId,
    actorUserId: auth.ctx.user.id,
  }, {
    orderId,
    amount: parsed.data.amount,
    paymentStatus: newPaymentStatus,
  }).catch(() => {})

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/billing')
  return { success: true, data: payment }
}

export async function batchMarkPaid(orderIds: string[], paymentDate: string) {
  if (!orderIds || orderIds.length === 0) {
    return { error: 'No orders selected' }
  }

  if (!paymentDate || paymentDate.trim() === '') {
    return { error: 'Payment date is required' }
  }

  const auth = await authorize('payments.create', { rateLimit: { key: 'batchMarkPaid', limit: 5, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Process each order: insert remaining balance as payment and mark as paid
  const results = await Promise.allSettled(
    orderIds.map(async (orderId) => {
      // Fetch order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('carrier_pay, amount_paid')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single()

      if (orderError || !order) {
        throw new Error(orderError?.message ?? `Order ${orderId} not found`)
      }

      const carrierPay = parseFloat(order.carrier_pay)
      const currentPaid = parseFloat(order.amount_paid)
      const remaining = Math.round((carrierPay - currentPaid) * 100) / 100

      // Only insert payment if there's a remaining balance
      if (remaining > 0) {
        const { error: insertError } = await supabase
          .from('payments')
          .insert({
            tenant_id: tenantId,
            order_id: orderId,
            amount: String(remaining),
            payment_date: paymentDate,
            notes: 'Batch payment',
          })

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      // Update order to fully paid
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          amount_paid: String(carrierPay),
          payment_status: 'paid',
        })
        .eq('id', orderId)
        .eq('tenant_id', tenantId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      return orderId
    })
  )

  // Fire-and-forget activity logs for each processed order
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      logOrderActivity(supabase, {
        tenantId,
        orderId: orderIds[i],
        action: 'batch_marked_paid',
        description: 'Marked as paid (batch)',
        actorId: auth.ctx.user.id,
        actorEmail: auth.ctx.user.email,
        metadata: { paymentDate },
      }).catch(() => {})
    }
  }

  revalidatePath('/billing')
  revalidatePath('/orders')

  const processed = results.filter((r) => r.status === 'fulfilled').length

  return {
    success: true,
    processed,
    total: orderIds.length,
  }
}

/**
 * Record COD payment for SPLIT orders.
 * Marks the COD portion as collected by adding cod_amount to amount_paid.
 */
export async function recordCodPayment(orderId: string) {
  const auth = await authorize('payments.create', { rateLimit: { key: 'recordCodPayment', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid, payment_status, payment_type, cod_amount, billing_amount')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Order not found' }
  }

  // Validate: must be a SPLIT order with a cod_amount
  if (order.payment_type !== 'SPLIT' || !order.cod_amount) {
    return { error: 'This order is not a SPLIT payment type or has no COD amount' }
  }

  const carrierPay = parseFloat(order.carrier_pay)
  const currentPaid = parseFloat(order.amount_paid)
  const codAmount = parseFloat(order.cod_amount)

  // Check if COD was already collected (amount_paid already includes cod_amount)
  // COD is the first thing collected, so if amount_paid >= cod_amount, it's already done
  if (currentPaid >= codAmount) {
    return { error: 'COD amount has already been collected' }
  }

  // Insert a payment record for the COD portion
  const { data: payment, error: insertError } = await supabase
    .from('payments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      amount: String(codAmount),
      payment_date: new Date().toISOString().split('T')[0],
      notes: 'COD collected at delivery',
    })
    .select()
    .single()

  if (insertError) {
    return { error: safeError(insertError, 'recordCodPayment') }
  }

  // Calculate new total paid
  const newTotalPaid = currentPaid + codAmount

  // Determine new payment_status
  let newPaymentStatus: string
  if (Math.abs(carrierPay - newTotalPaid) < 0.01 || newTotalPaid >= carrierPay) {
    newPaymentStatus = 'paid'
  } else if (newTotalPaid > 0) {
    newPaymentStatus = 'partially_paid'
  } else {
    newPaymentStatus = order.payment_status
  }

  // Update order with new amount_paid and payment_status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      amount_paid: String(Math.round(newTotalPaid * 100) / 100),
      payment_status: newPaymentStatus,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'recordCodPayment') }
  }

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'cod_payment_collected',
    description: `COD payment of $${codAmount.toFixed(2)} collected at delivery`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { codAmount, newPaymentStatus },
  }).catch(() => {})

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/billing')
  return { success: true, data: payment }
}
