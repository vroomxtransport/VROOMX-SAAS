'use server'

import { authorize, safeError } from '@/lib/authz'
import { recordPaymentSchema } from '@/lib/validations/payment'
import { revalidatePath } from 'next/cache'

export async function recordPayment(orderId: string, data: unknown) {
  const parsed = recordPaymentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('payments.create', { rateLimit: { key: 'recordPayment', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch the order to get current carrier_pay and amount_paid
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('carrier_pay, amount_paid, payment_status')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Order not found' }
  }

  const carrierPay = parseFloat(order.carrier_pay)
  const currentPaid = parseFloat(order.amount_paid)
  const remaining = carrierPay - currentPaid

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

  revalidatePath('/billing')
  revalidatePath('/orders')

  const processed = results.filter((r) => r.status === 'fulfilled').length

  return {
    success: true,
    processed,
    total: orderIds.length,
  }
}
