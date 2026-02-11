import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
})

// Map plan names to Stripe Price IDs
export const PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID!,
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
}

// Reverse map: Price ID -> plan name
export const PLAN_FROM_PRICE: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_MAP).map(([plan, priceId]) => [priceId, plan])
)
