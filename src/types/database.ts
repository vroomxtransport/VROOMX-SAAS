export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface TenantMembership {
  id: string
  tenant_id: string
  user_id: string
  role: string
  created_at: string
  updated_at: string
}

export interface StripeEvent {
  id: string
  event_id: string
  event_type: string
  processed_at: string
}
