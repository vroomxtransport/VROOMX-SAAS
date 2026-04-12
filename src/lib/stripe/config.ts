import Stripe from 'stripe'

// Lazy-loaded Stripe client to avoid build-time instantiation
let _stripe: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    })
  }
  return _stripe
}

// Legacy export for backwards compatibility
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    return (getStripeClient() as unknown as Record<string | symbol, unknown>)[prop]
  }
})

// Map plan names to Stripe Price IDs (lazy evaluated).
// Plan keys must match src/types/index.ts SubscriptionPlan union.
// The env var names must match .env.local.example + startup-checks.ts.
export function getPriceMap(): Record<string, string> {
  return {
    owner_operator: process.env.STRIPE_OWNER_OPERATOR_PRICE_ID!,
    starter_x:      process.env.STRIPE_STARTER_X_PRICE_ID!,
    pro_x:          process.env.STRIPE_PRO_X_PRICE_ID!,
  }
}

// Legacy export for backwards compatibility
export const PRICE_MAP: Record<string, string> = new Proxy({}, {
  get(target, prop: string) {
    return getPriceMap()[prop]
  },
  ownKeys() {
    return Object.keys(getPriceMap())
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      value: getPriceMap()[prop as string]
    }
  }
})

// Reverse map: Price ID -> plan name (lazy evaluated)
export function getPlanFromPrice(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(getPriceMap()).map(([plan, priceId]) => [priceId, plan])
  )
}

// Legacy export for backwards compatibility
export const PLAN_FROM_PRICE: Record<string, string> = new Proxy({}, {
  get(target, prop: string) {
    return getPlanFromPrice()[prop]
  },
  ownKeys() {
    return Object.keys(getPlanFromPrice())
  },
  getOwnPropertyDescriptor(target, prop) {
    return {
      enumerable: true,
      configurable: true,
      value: getPlanFromPrice()[prop as string]
    }
  }
})
