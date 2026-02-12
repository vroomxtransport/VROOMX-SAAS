import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'
import { BillingSection } from './billing-section'
import { UsageSection } from './usage-section'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id

  if (!tenantId) {
    redirect('/login')
  }

  // Fetch tenant details
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, plan, subscription_status, stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    redirect('/login')
  }

  // Fetch counts for usage section
  const admin = createServiceRoleClient()
  const [trucksCount, membershipsCount] = await Promise.all([
    supabase.from('trucks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('tenant_memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your subscription, usage, and team.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <BillingSection
          plan={tenant.plan}
          subscriptionStatus={tenant.subscription_status}
          hasStripeCustomer={!!tenant.stripe_customer_id}
        />
        <UsageSection
          plan={tenant.plan}
          truckCount={trucksCount.count ?? 0}
          userCount={membershipsCount.count ?? 0}
        />
      </div>
    </div>
  )
}
