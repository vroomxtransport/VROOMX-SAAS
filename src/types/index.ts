// Tenant roles
export type TenantRole = 'owner' | 'admin' | 'dispatcher' | 'viewer'

// Subscription plans
export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise'

// Subscription status
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

// Tier limits
export const TIER_LIMITS: Record<SubscriptionPlan, { trucks: number; users: number }> = {
  starter: { trucks: 5, users: 3 },
  pro: { trucks: 20, users: 10 },
  enterprise: { trucks: Infinity, users: Infinity },
}

// Pricing (monthly, in dollars)
export const TIER_PRICING: Record<SubscriptionPlan, number> = {
  starter: 49,
  pro: 149,
  enterprise: 299,
}
