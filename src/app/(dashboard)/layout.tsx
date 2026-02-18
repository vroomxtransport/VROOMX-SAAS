import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SidebarLayoutWrapper } from '@/components/layout/sidebar-layout-wrapper'
import { QueryProvider } from '@/components/providers/query-provider'
import { AlertTriangle } from 'lucide-react'
import type { TenantRole, SubscriptionStatus } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    console.error('[DASHBOARD_LAYOUT] Failed to create Supabase client:', e)
    redirect('/login')
  }

  // Check authentication
  let user
  try {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError || !data.user) {
      console.error('[DASHBOARD_LAYOUT] Auth failed:', authError?.message)
      redirect('/login')
    }
    user = data.user
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e
    console.error('[DASHBOARD_LAYOUT] Auth exception:', e)
    redirect('/login')
  }

  // Get tenant info from app_metadata (set during signup)
  const tenantId = user.app_metadata?.tenant_id
  const userRole = user.app_metadata?.role as TenantRole

  if (!tenantId || !userRole) {
    redirect('/login')
  }

  // Fetch tenant details
  let tenant
  try {
    const { data, error: tenantError } = await supabase
      .from('tenants')
      .select('name, plan, subscription_status, grace_period_ends_at, is_suspended')
      .eq('id', tenantId)
      .single()

    if (tenantError || !data) {
      console.error('[DASHBOARD_LAYOUT] Tenant fetch failed:', tenantError?.message)
      redirect('/login')
    }
    tenant = data
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e
    console.error('[DASHBOARD_LAYOUT] Tenant fetch exception:', e)
    redirect('/login')
  }

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="flex h-screen overflow-hidden bg-content-bg">
      <Sidebar userRole={userRole} tenantName={tenant.name} />

      <SidebarLayoutWrapper>
        <QueryProvider>
        <Header
          userName={userName}
          userEmail={user.email!}
          tenantName={tenant.name}
          userRole={userRole}
          plan={tenant.plan}
          subscriptionStatus={tenant.subscription_status as SubscriptionStatus}
          userId={user.id}
        />

        <main className="flex-1 overflow-y-auto">
          {/* Suspension overlay */}
          {tenant.is_suspended && (
            <div className="mx-4 mb-4 mt-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 lg:mx-8">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-400">Account Suspended</p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Your account has been suspended due to a failed payment. Please update your payment method to restore access.
                    You can view existing data but cannot create new resources.
                  </p>
                </div>
                <form action={async () => { 'use server'; const { createBillingPortalSession } = await import('@/app/actions/billing'); await createBillingPortalSession(); }}>
                  <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                    Update Payment
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Grace period warning */}
          {!tenant.is_suspended && tenant.grace_period_ends_at && (
            <div className="mx-4 mb-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 lg:mx-8">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-400">Payment Issue</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Your recent payment failed. Please update your payment method by{' '}
                    {new Date(tenant.grace_period_ends_at).toLocaleDateString()} to avoid service interruption.
                  </p>
                </div>
                <form action={async () => { 'use server'; const { createBillingPortalSession } = await import('@/app/actions/billing'); await createBillingPortalSession(); }}>
                  <button type="submit" className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
                    Update Payment
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="p-3 lg:px-6 lg:py-4">
              {children}
          </div>
        </main>
        </QueryProvider>
      </SidebarLayoutWrapper>
    </div>
  )
}
