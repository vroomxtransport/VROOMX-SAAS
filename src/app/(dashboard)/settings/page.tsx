import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'
import { BillingSection } from './billing-section'
import { UsageSection } from './usage-section'
import { TeamSection } from './team-section'
import { SeedSection } from './seed-section'
import type { TenantRole } from '@/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  const userRole = user.app_metadata?.role as TenantRole

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

  // Fetch counts for usage section and team members via service role
  const admin = createServiceRoleClient()
  const [trucksCount, membershipsResult, pendingInvitesResult] = await Promise.all([
    supabase.from('trucks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('tenant_memberships').select('id, user_id, role, created_at', { count: 'exact' }).eq('tenant_id', tenantId).order('created_at', { ascending: true }),
    supabase.from('invites').select('id, email, role, created_at, expires_at').eq('tenant_id', tenantId).eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  const memberships = membershipsResult.data || []
  const membershipsCount = membershipsResult.count ?? 0

  // Fetch user details for each membership
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 100 })
  const userMap = new Map(
    (usersData?.users || []).map(u => [u.id, { email: u.email || '', name: u.user_metadata?.full_name || '' }])
  )

  const teamMembers = memberships.map(m => ({
    id: m.id,
    userId: m.user_id,
    email: userMap.get(m.user_id)?.email || 'Unknown',
    name: userMap.get(m.user_id)?.name || '',
    role: m.role as TenantRole,
    joinedAt: m.created_at,
  }))

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
          userCount={membershipsCount}
        />
      </div>

      {/* Team management for admins and owners */}
      {(userRole === 'owner' || userRole === 'admin') && (
        <TeamSection
          teamMembers={teamMembers}
          pendingInvites={pendingInvitesResult.data || []}
          currentUserId={user.id}
          userRole={userRole}
          plan={tenant.plan}
        />
      )}

      {/* Sample data management for owners */}
      <SeedSection isOwner={userRole === 'owner'} />
    </div>
  )
}
