import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionSection } from '../subscription-section'
import type { TenantRole } from '@/types'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  const userRole = (user.app_metadata?.role ?? 'dispatcher') as TenantRole

  if (!tenantId) {
    redirect('/login')
  }

  if (userRole !== 'owner' && userRole !== 'admin') {
    redirect('/settings/profile')
  }

  let tenant: {
    plan: string
    subscription_status: string
    stripe_customer_id: string | null
    grace_period_ends_at: string | null
    trial_ends_at: string | null
  } | null = null
  let truckCount = 0
  let userCount = 0

  try {
    const [tenantResult, trucksResult, membershipsResult] = await Promise.all([
      supabase
        .from('tenants')
        .select('plan, subscription_status, stripe_customer_id, grace_period_ends_at, trial_ends_at')
        .eq('id', tenantId)
        .single(),
      supabase
        .from('trucks')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('tenant_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    if (tenantResult.error || !tenantResult.data) {
      redirect('/login')
    }

    tenant = tenantResult.data
    truckCount = trucksResult.count ?? 0
    userCount = membershipsResult.count ?? 0
  } catch (e) {
    console.error('[SETTINGS/PLAN] Data fetch failed:', e)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Unable to load billing information. Please refresh the page.
        </p>
      </div>
    )
  }

  if (!tenant) {
    redirect('/login')
  }

  return (
    <SubscriptionSection
      currentPlan={tenant.plan}
      subscriptionStatus={tenant.subscription_status}
      hasStripeCustomer={!!tenant.stripe_customer_id}
      gracePeriodEndsAt={tenant.grace_period_ends_at}
      trialEndsAt={tenant.trial_ends_at}
      truckCount={truckCount}
      userCount={userCount}
    />
  )
}
