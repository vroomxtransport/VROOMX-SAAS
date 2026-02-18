import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redirect } from 'next/navigation'
import { SubscriptionSection } from './subscription-section'
import { CompanySection } from './company-section'
import { TeamSection } from './team-section'
import { RolesSection } from './roles-section'
import { SeedSection } from './seed-section'
import { PageHeader } from '@/components/shared/page-header'
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

  // Fetch tenant details and resource counts in parallel
  const admin = createServiceRoleClient()
  const [tenantResult, trucksResult, membershipsResult, pendingInvitesResult, customRolesResult] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, plan, subscription_status, stripe_customer_id, grace_period_ends_at, trial_ends_at, factoring_fee_rate')
      .eq('id', tenantId)
      .single(),
    supabase
      .from('trucks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('tenant_memberships')
      .select('id, user_id, role, created_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invites')
      .select('id, email, role, created_at, expires_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('custom_roles')
      .select('id, name, description, permissions, created_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true }),
  ])

  const tenant = tenantResult.data
  if (!tenant) {
    redirect('/login')
  }

  const memberships = membershipsResult.data || []
  const membershipsCount = membershipsResult.count ?? 0
  const truckCount = trucksResult.count ?? 0

  // Fetch user details only for this tenant's members
  const memberUserIds = memberships.map(m => m.user_id)
  const userMap = new Map<string, { email: string; name: string }>()
  for (const uid of memberUserIds) {
    const { data } = await admin.auth.admin.getUserById(uid)
    if (data?.user) {
      userMap.set(uid, { email: data.user.email || '', name: data.user.user_metadata?.full_name || '' })
    }
  }

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
      <PageHeader
        title="Settings"
        subtitle="Manage your subscription, team, and account preferences."
      />

      {/* Subscription & Plan Management */}
      <SubscriptionSection
        currentPlan={tenant.plan}
        subscriptionStatus={tenant.subscription_status}
        hasStripeCustomer={!!tenant.stripe_customer_id}
        gracePeriodEndsAt={tenant.grace_period_ends_at}
        trialEndsAt={tenant.trial_ends_at}
        truckCount={truckCount}
        userCount={membershipsCount}
      />

      {/* Company settings for admins */}
      {(userRole === 'owner' || userRole === 'admin') && (
        <CompanySection factoringFeeRate={tenant.factoring_fee_rate ?? '0'} />
      )}

      {/* Team management for admins */}
      {(userRole === 'owner' || userRole === 'admin') && (
        <TeamSection
          teamMembers={teamMembers}
          pendingInvites={pendingInvitesResult.data || []}
          currentUserId={user.id}
          userRole={userRole}
          plan={tenant.plan}
        />
      )}

      {/* Roles & Permissions for admins */}
      {(userRole === 'owner' || userRole === 'admin') && (
        <RolesSection customRoles={customRolesResult.data || []} />
      )}

      {/* Sample data management for admins */}
      <SeedSection isOwner={userRole === 'owner' || userRole === 'admin'} />
    </div>
  )
}
