import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { TeamSection } from '../team-section'
import type { TenantRole } from '@/types'

export default async function MembersPage() {
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

  // M3 fix: read tenant data via the RLS-scoped user client. The previous
  // version used a service-role client for the membership query, which
  // unnecessarily expanded the blast radius — RLS already enforces tenant
  // isolation on tenant_memberships, invites, and tenants. The service-role
  // client is now created lazily and used ONLY for auth.admin.getUserById
  // calls below (which require admin privileges to read auth.users).

  let memberships: Array<{
    id: string
    user_id: string
    role: string
    full_name: string | null
    email: string | null
    created_at: string
  }> = []

  let pendingInvites: Array<{
    id: string
    email: string
    role: string
    created_at: string
    expires_at: string
  }> = []

  let tenantPlan = 'owner_operator'

  try {
    const [membershipsResult, pendingInvitesResult, tenantResult] = await Promise.all([
      supabase
        .from('tenant_memberships')
        .select('id, user_id, role, full_name, email, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
      supabase
        .from('invites')
        .select('id, email, role, created_at, expires_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('tenants')
        .select('plan')
        .eq('id', tenantId)
        .single(),
    ])

    memberships = membershipsResult.data ?? []
    pendingInvites = pendingInvitesResult.data ?? []
    tenantPlan = tenantResult.data?.plan ?? 'owner_operator'
  } catch (e) {
    console.error('[SETTINGS/MEMBERS] Data fetch failed:', e)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Unable to load team members. Please refresh the page.
        </p>
      </div>
    )
  }

  // Service-role client is needed ONLY for auth.admin.getUserById, which
  // reads from auth.users (a schema not exposed via PostgREST RLS). All
  // tenant-scoped reads above use the user client.
  let admin: ReturnType<typeof createServiceRoleClient>
  try {
    admin = createServiceRoleClient()
  } catch (e) {
    console.error('[SETTINGS/MEMBERS] Failed to create service role client:', e)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-800">
          Unable to load team members. Please try again later.
        </p>
      </div>
    )
  }

  // Fetch auth user details for each member — use membership data as fallback for deleted users
  const userMap = new Map<string, { email: string; name: string }>()
  for (const membership of memberships) {
    try {
      const { data } = await admin.auth.admin.getUserById(membership.user_id)
      if (data?.user) {
        userMap.set(membership.user_id, {
          email: data.user.email ?? '',
          name: data.user.user_metadata?.full_name ?? '',
        })
      } else {
        userMap.set(membership.user_id, {
          email: membership.email ?? '',
          name: membership.full_name ?? 'Unknown User',
        })
      }
    } catch {
      // User may be deleted from auth — fall back to membership table data
      userMap.set(membership.user_id, {
        email: membership.email ?? '',
        name: membership.full_name ?? 'Unknown User',
      })
    }
  }

  const teamMembers = memberships.map((m) => ({
    id: m.id,
    userId: m.user_id,
    email: userMap.get(m.user_id)?.email ?? 'Unknown',
    name: userMap.get(m.user_id)?.name ?? '',
    role: m.role as TenantRole,
    joinedAt: m.created_at,
  }))

  return (
    <TeamSection
      teamMembers={teamMembers}
      pendingInvites={pendingInvites}
      currentUserId={user.id}
      userRole={userRole}
      plan={tenantPlan}
    />
  )
}
