import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { QueryProvider } from '@/components/providers/query-provider'
import { AlertTriangle } from 'lucide-react'
import type { TenantRole, SubscriptionStatus } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get tenant info from app_metadata (set during signup)
  const tenantId = user.app_metadata?.tenant_id
  const userRole = user.app_metadata?.role as TenantRole

  if (!tenantId || !userRole) {
    redirect('/login')
  }

  // Fetch tenant details
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, plan, subscription_status, grace_period_ends_at, is_suspended')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    redirect('/login')
  }

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar userRole={userRole} tenantName={tenant.name} />

      <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
        <Header
          userName={userName}
          userEmail={user.email!}
          tenantName={tenant.name}
          userRole={userRole}
          plan={tenant.plan}
          subscriptionStatus={tenant.subscription_status as SubscriptionStatus}
        />

        <main className="flex-1 overflow-y-auto">
          {/* Suspension overlay */}
          {tenant.is_suspended && (
            <div className="mx-4 mb-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 lg:mx-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Account Suspended</p>
                  <p className="text-sm text-red-700">
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
            <div className="mx-4 mb-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 lg:mx-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">Payment Issue</p>
                  <p className="text-sm text-amber-700">
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

          <div className="p-4 lg:p-6">
            <QueryProvider>
              {children}
            </QueryProvider>
          </div>
        </main>
      </div>
    </div>
  )
}
