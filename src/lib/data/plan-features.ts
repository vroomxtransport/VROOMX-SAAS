import { TIER_LIMITS, TIER_PRICING, type SubscriptionPlan } from '@/types'

export interface PlanFeature {
  text: string
}

export interface PlanDefinition {
  key: SubscriptionPlan
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  limits: { trucks: number; users: number }
  features: PlanFeature[]
  includes: string[]
  buttonText: string
  popular?: boolean
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'Perfect for small carriers just getting started with digital dispatch',
    monthlyPrice: TIER_PRICING.starter,
    yearlyPrice: Math.round(TIER_PRICING.starter * 12 * 0.8),
    limits: TIER_LIMITS.starter,
    features: [
      { text: 'Up to 50 orders/month' },
      { text: `${TIER_LIMITS.starter.trucks} trucks, ${TIER_LIMITS.starter.users} team members` },
      { text: 'Email support' },
    ],
    includes: [
      'Free includes:',
      'Basic dispatch board',
      'Order management',
      'Driver mobile app',
      'Invoice generation',
    ],
    buttonText: 'Downgrade',
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'Best value for growing fleets that need advanced dispatch and analytics',
    monthlyPrice: TIER_PRICING.pro,
    yearlyPrice: Math.round(TIER_PRICING.pro * 12 * 0.8),
    limits: TIER_LIMITS.pro,
    popular: true,
    features: [
      { text: 'Unlimited orders' },
      { text: `${TIER_LIMITS.pro.trucks} trucks, ${TIER_LIMITS.pro.users} team members` },
      { text: 'Priority support' },
    ],
    includes: [
      'Everything in Starter, plus:',
      'Kanban dispatch board',
      'Revenue analytics',
      'Broker management',
      'Automated invoicing',
    ],
    buttonText: 'Upgrade Plan',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Full-scale solution with custom integrations and dedicated support for large fleets',
    monthlyPrice: TIER_PRICING.enterprise,
    yearlyPrice: Math.round(TIER_PRICING.enterprise * 12 * 0.8),
    limits: TIER_LIMITS.enterprise,
    features: [
      { text: 'Unlimited everything' },
      { text: 'Unlimited fleet size' },
      { text: 'Dedicated account manager' },
    ],
    includes: [
      'Everything in Pro, plus:',
      'Custom integrations',
      'Multi-terminal support',
      'SLA guarantee',
      'Custom roles & permissions',
      'Unlimited team members',
    ],
    buttonText: 'Contact Sales',
  },
]

export function getPlanDefinition(plan: SubscriptionPlan): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find(p => p.key === plan)
}
