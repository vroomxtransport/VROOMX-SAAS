'use server'

import { authorize } from '@/lib/authz'
import { redirect } from 'next/navigation'
import { createPortalSession } from '@/lib/stripe/billing-portal'
import { getStripeClient, getPriceMap } from '@/lib/stripe/config'
import type { SubscriptionPlan } from '@/types'

/**
 * Creates a Stripe Billing Portal session and redirects the user.
 * Used from Billing page for upgrade/downgrade CTAs.
 */
export async function createBillingPortalSession() {
  const auth = await authorize('billing.manage', { checkSuspension: false })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch stripe_customer_id from tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_customer_id) {
    return { error: 'No billing account found. Please contact support.' }
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`

  try {
    const portalUrl = await createPortalSession(tenant.stripe_customer_id, returnUrl)
    redirect(portalUrl)
  } catch (error) {
    // redirect() throws a special error that must be re-thrown
    if ((error as any)?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    console.error('Failed to create billing portal session:', error)
    return { error: 'Failed to open billing portal. Please try again.' }
  }
}

/**
 * Creates a Stripe Checkout session for trial users without a Stripe customer.
 * Redirects to Stripe Checkout to collect payment and start subscription.
 */
export async function createCheckoutSession(plan: SubscriptionPlan) {
  const auth = await authorize('billing.manage', { checkSuspension: false })
  if (!auth.ok) return { error: auth.error }
  const { user } = auth.ctx

  const priceMap = getPriceMap()
  const priceId = priceMap[plan]

  if (!priceId) {
    return { error: 'Invalid plan selected.' }
  }

  const stripe = getStripeClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?checkout=success`,
      cancel_url: `${appUrl}/settings?checkout=canceled`,
      customer_email: user.email,
      metadata: {
        tenant_id: auth.ctx.tenantId,
        user_id: user.id,
      },
    })

    if (!session.url) {
      return { error: 'Failed to create checkout session.' }
    }

    redirect(session.url)
  } catch (error) {
    if ((error as any)?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    console.error('Failed to create checkout session:', error)
    return { error: 'Failed to start checkout. Please try again.' }
  }
}
