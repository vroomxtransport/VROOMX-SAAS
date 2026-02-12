import Stripe from 'stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { PLAN_FROM_PRICE } from './config'

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceRoleClient()
  const tenantId = session.metadata?.tenant_id

  if (!tenantId) {
    console.error('checkout.session.completed: missing tenant_id in metadata')
    return
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  if (!subscriptionId) {
    console.error('checkout.session.completed: missing subscription ID')
    return
  }

  const { error } = await supabase
    .from('tenants')
    .update({
      stripe_subscription_id: subscriptionId,
      subscription_status: 'trialing',
    })
    .eq('id', tenantId)

  if (error) {
    console.error('checkout.session.completed: failed to update tenant', error)
    throw error
  }
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createServiceRoleClient()
  const tenantId = subscription.metadata?.tenant_id

  if (!tenantId) {
    console.error('subscription.updated: missing tenant_id in metadata')
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const plan = priceId ? (PLAN_FROM_PRICE[priceId] || 'unknown') : 'unknown'

  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'unpaid',
    incomplete_expired: 'canceled',
    paused: 'past_due',
  }

  const subscriptionStatus = statusMap[subscription.status] || subscription.status

  const { error } = await supabase
    .from('tenants')
    .update({
      plan,
      subscription_status: subscriptionStatus,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', tenantId)

  if (error) {
    console.error('subscription.updated: failed to update tenant', error)
    throw error
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createServiceRoleClient()
  const tenantId = subscription.metadata?.tenant_id

  if (!tenantId) {
    console.error('subscription.deleted: missing tenant_id in metadata')
    return
  }

  const { error } = await supabase
    .from('tenants')
    .update({ subscription_status: 'canceled' })
    .eq('id', tenantId)

  if (error) {
    console.error('subscription.deleted: failed to update tenant', error)
    throw error
  }
}

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  // Extract subscription ID from invoice
  // Type assertion needed because Stripe's types don't reflect runtime expandable fields
  const subscription = (invoice as any).subscription
  if (!subscription) return

  const subscriptionId = typeof subscription === 'string'
    ? subscription
    : subscription.id

  if (!subscriptionId) return

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!tenant) {
    console.error('payment_failed: no tenant found for subscription', subscriptionId)
    return
  }

  const { error } = await supabase
    .from('tenants')
    .update({ subscription_status: 'past_due' })
    .eq('id', tenant.id)

  if (error) {
    console.error('payment_failed: failed to update tenant', error)
    throw error
  }
}

/**
 * Handle successful invoice payment - clears grace period and suspension.
 * Fires on every successful payment (initial, renewal, manual retry).
 */
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  const subscription = (invoice as any).subscription
  if (!subscription) return

  const subscriptionId = typeof subscription === 'string'
    ? subscription
    : subscription.id

  if (!subscriptionId) return

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!tenant) {
    console.error('invoice.paid: no tenant found for subscription', subscriptionId)
    return
  }

  // Clear grace period and suspension on successful payment
  const { error } = await supabase
    .from('tenants')
    .update({
      subscription_status: 'active',
      grace_period_ends_at: null,
      is_suspended: false,
    })
    .eq('id', tenant.id)

  if (error) {
    console.error('invoice.paid: failed to update tenant', error)
    throw error
  }
}

/**
 * Handle payment failure with grace period.
 * Replaces simple status update with grace period logic.
 * Sets grace_period_ends_at to 14 days from now (only if not already in grace).
 */
export async function handlePaymentFailedWithGrace(invoice: Stripe.Invoice) {
  const supabase = createServiceRoleClient()

  const subscription = (invoice as any).subscription
  if (!subscription) return

  const subscriptionId = typeof subscription === 'string'
    ? subscription
    : subscription.id

  if (!subscriptionId) return

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, grace_period_ends_at')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  if (!tenant) {
    console.error('payment_failed_grace: no tenant found for subscription', subscriptionId)
    return
  }

  // Build update: always set past_due, only set grace period if not already in one
  const updates: Record<string, any> = {
    subscription_status: 'past_due',
  }

  if (!tenant.grace_period_ends_at) {
    updates.grace_period_ends_at = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000  // 14 days
    ).toISOString()
  }

  const { error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenant.id)

  if (error) {
    console.error('payment_failed_grace: failed to update tenant', error)
    throw error
  }
}
