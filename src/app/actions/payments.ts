'use server'

import { authorize, safeError } from '@/lib/authz'
import { recordPaymentSchema } from '@/lib/validations/payment'
import { logOrderActivity } from '@/lib/activity-log'
import { syncPaymentToQB } from '@/lib/quickbooks/sync'
import { revalidatePath } from 'next/cache'
import { revalidateFinancialDashboards } from '@/lib/revalidate-helpers'
import { equalsCurrency, gteCurrency, roundCurrency, sumCurrencyStrings, toCurrencyString } from '@/lib/financial/money'
import { dispatchWebhookEvent } from '@/lib/webhooks/webhook-dispatcher'
import { sanitizePayload } from '@/lib/webhooks/payload-sanitizer'
import { captureAsyncError } from '@/lib/async-safe'

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

  // Validate: payment amount must not exceed remaining balance, tolerating
  // half-a-cent float drift (see equalsCurrency / gteCurrency in money.ts).
  if (!gteCurrency(remaining, parsed.data.amount)) {
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
  if (equalsCurrency(newTotalPaid, carrierPay) || gteCurrency(newTotalPaid, carrierPay)) {
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
      amount_paid: toCurrencyString(newTotalPaid),
      payment_status: newPaymentStatus,
    })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'recordPayment') }
  }

  // Fire-and-forget: sync payment to QuickBooks
  void syncPaymentToQB(supabase, tenantId, orderId, parsed.data.amount, parsed.data.paymentDate).catch(captureAsyncError('payment action'))

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'payment_recorded',
    description: `Payment of $${parsed.data.amount.toFixed(2)} recorded`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { amount: parsed.data.amount, paymentDate: parsed.data.paymentDate, newPaymentStatus },
  }).catch(captureAsyncError('payment action'))

  dispatchWebhookEvent(tenantId, 'payment.received', sanitizePayload({
    order_id: orderId, amount: parsed.data.amount, payment_date: parsed.data.paymentDate,
  })).catch(captureAsyncError('payment action'))

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/billing')
  revalidateFinancialDashboards()
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
      const remaining = roundCurrency(carrierPay - currentPaid)

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
      }).catch(captureAsyncError('payment action'))
    }
  }

  revalidatePath('/billing')
  revalidateFinancialDashboards()
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
  if (equalsCurrency(newTotalPaid, carrierPay) || gteCurrency(newTotalPaid, carrierPay)) {
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
      amount_paid: toCurrencyString(newTotalPaid),
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
  }).catch(captureAsyncError('payment action'))

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/billing')
  revalidateFinancialDashboards()
  return { success: true, data: payment }
}

/**
 * Delete a payment row and reconcile the parent order's amount_paid +
 * payment_status from the remaining payments. Audit AUD-1 #1: without
 * this, deleting a payment row directly leaves orders.amount_paid stale
 * and P&L drifts.
 *
 * Uses sum-of-remaining (not subtract) so split payments, COD, and
 * partial refunds all reconcile correctly. Calls recalculateTripFinancials
 * if the order is on a trip.
 */
export async function deletePayment(paymentId: string) {
  if (!paymentId || typeof paymentId !== 'string') {
    return { error: 'Payment id is required.' }
  }

  try {
    const auth = await authorize('payments.delete', {
      rateLimit: { key: 'deletePayment', limit: 20, windowMs: 60_000 },
    })
    if (!auth.ok) return { error: auth.error }
    const { supabase, tenantId, user } = auth.ctx

    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('id, amount, order_id')
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (fetchErr) return { error: safeError(fetchErr, 'deletePayment.fetch') }
    if (!payment) return { error: 'Payment not found.' }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, carrier_pay, trip_id, payment_status')
      .eq('id', payment.order_id)
      .eq('tenant_id', tenantId)
      .single()
    if (orderErr || !order) {
      return { error: 'Parent order not found.' }
    }

    const { error: deleteErr } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
    if (deleteErr) return { error: safeError(deleteErr, 'deletePayment.delete') }

    // Re-sum REMAINING payments — authoritative source. Avoids float drift
    // that would accumulate from "subtract from amount_paid" across many
    // partial payment edits.
    const { data: remaining, error: sumErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', payment.order_id)
      .eq('tenant_id', tenantId)
    if (sumErr) return { error: safeError(sumErr, 'deletePayment.sum') }

    const newTotalPaid = sumCurrencyStrings(
      (remaining ?? []).map((r) => (r as { amount: string }).amount),
    )

    const carrierPay = parseFloat(order.carrier_pay)
    let newStatus: 'unpaid' | 'partially_paid' | 'paid' | 'invoiced'
    if (newTotalPaid <= 0) {
      newStatus = order.payment_status === 'invoiced' ? 'invoiced' : 'unpaid'
    } else if (equalsCurrency(newTotalPaid, carrierPay) || gteCurrency(newTotalPaid, carrierPay)) {
      newStatus = 'paid'
    } else {
      newStatus = 'partially_paid'
    }

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        amount_paid: toCurrencyString(newTotalPaid),
        payment_status: newStatus,
      })
      .eq('id', payment.order_id)
      .eq('tenant_id', tenantId)
    if (updateErr) return { error: safeError(updateErr, 'deletePayment.update') }

    if (order.trip_id) {
      const { recalculateTripFinancials } = await import('@/app/actions/trips')
      await recalculateTripFinancials(order.trip_id)
    }

    logOrderActivity(supabase, {
      tenantId,
      orderId: payment.order_id,
      action: 'payment_deleted',
      description: `Deleted payment of $${parseFloat(payment.amount).toFixed(2)} (new total paid: $${toCurrencyString(newTotalPaid)})`,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { paymentId, deletedAmount: payment.amount, newAmountPaid: toCurrencyString(newTotalPaid), newPaymentStatus: newStatus },
    }).catch(captureAsyncError('deletePayment'))

    revalidatePath(`/orders/${payment.order_id}`)
    revalidatePath('/billing')
    revalidateFinancialDashboards()
    return { success: true }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'deletePayment.throw') }
  }
}
