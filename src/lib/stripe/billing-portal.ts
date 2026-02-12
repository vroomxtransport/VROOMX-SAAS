import { stripe } from './config'

/**
 * Creates a Stripe Billing Portal session for the given customer.
 * Returns the portal URL for redirect.
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  })
  return session.url
}
