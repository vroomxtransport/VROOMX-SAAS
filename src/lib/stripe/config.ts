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
    return (getStripeClient() as any)[prop]
  }
})

// Map plan names to Stripe Price IDs (lazy evaluated)
export function getPriceMap(): Record<string, string> {
  return {
    starter: process.env.STRIPE_STARTER_PRICE_ID!,
    pro: process.env.STRIPE_PRO_PRICE_ID!,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
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
