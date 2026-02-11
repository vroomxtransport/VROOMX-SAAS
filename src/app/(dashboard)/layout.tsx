import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { QueryProvider } from '@/components/providers/query-provider'
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
    .select('name, plan, subscription_status')
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <QueryProvider>
            {children}
          </QueryProvider>
        </main>
      </div>
    </div>
  )
}
