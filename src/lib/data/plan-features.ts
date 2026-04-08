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
    key: 'owner_operator',
    name: 'Owner-Operator',
    description: 'Built for the solo driver running their own truck and their own books',
    monthlyPrice: TIER_PRICING.owner_operator,
    yearlyPrice: Math.round(TIER_PRICING.owner_operator * 12 * 0.8),
    limits: TIER_LIMITS.owner_operator,
    features: [
      { text: 'Unlimited orders' },
      { text: `${TIER_LIMITS.owner_operator.trucks} truck, ${TIER_LIMITS.owner_operator.users} user` },
      { text: 'Email support' },
    ],
    includes: [
      'Includes:',
      'Order management',
      'Basic dispatch board',
      'Driver mobile app',
      'Invoice generation',
      'Load board integrations',
    ],
    buttonText: 'Start Free Trial',
  },
  {
    key: 'starter_x',
    name: 'Starter X',
    description: 'For small fleets taking on their first few drivers and building a dispatch workflow',
    monthlyPrice: TIER_PRICING.starter_x,
    yearlyPrice: Math.round(TIER_PRICING.starter_x * 12 * 0.8),
    limits: TIER_LIMITS.starter_x,
    popular: true,
    features: [
      { text: 'Unlimited orders' },
      { text: `Up to ${TIER_LIMITS.starter_x.trucks} trucks, ${TIER_LIMITS.starter_x.users} team members` },
      { text: 'Priority email support' },
    ],
    includes: [
      'Everything in Owner-Operator, plus:',
      'Kanban dispatch board',
      'Team roles & permissions',
      'Financial reports',
      'Broker management',
      'Automated invoicing',
    ],
    buttonText: 'Start Free Trial',
  },
  {
    key: 'pro_x',
    name: 'Pro X',
    description: 'For growing carriers that need fleet-scale dispatch, analytics, and integrations',
    monthlyPrice: TIER_PRICING.pro_x,
    yearlyPrice: Math.round(TIER_PRICING.pro_x * 12 * 0.8),
    limits: TIER_LIMITS.pro_x,
    features: [
      { text: 'Unlimited orders' },
      { text: `Up to ${TIER_LIMITS.pro_x.trucks} trucks, ${TIER_LIMITS.pro_x.users} team members` },
      { text: 'Phone + priority support' },
    ],
    includes: [
      'Everything in Starter X, plus:',
      'Samsara ELD integration',
      'Advanced analytics & KPIs',
      'Custom roles & permissions',
      'Multi-terminal support',
      'Driver onboarding pipeline (FMCSA Part 391)',
    ],
    buttonText: 'Start Free Trial',
  },
]

export function getPlanDefinition(plan: SubscriptionPlan): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.key === plan)
}
