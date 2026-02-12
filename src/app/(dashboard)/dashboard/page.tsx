import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, Users, Package, TrendingUp, ChevronRight } from 'lucide-react'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const params = await searchParams
  const showSetupBanner = params.setup === 'complete'

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
    .select('name, plan, subscription_status, trial_ends_at, onboarding_completed_at')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    redirect('/login')
  }

  // Fetch entity counts for onboarding detection and stat cards
  const [trucksResult, driversResult, ordersResult] = await Promise.all([
    supabase.from('trucks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
  ])

  const truckCount = trucksResult.count ?? 0
  const driverCount = driversResult.count ?? 0
  const orderCount = ordersResult.count ?? 0

  // Fetch month-to-date revenue
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: revenueData } = await supabase
    .from('orders')
    .select('revenue')
    .eq('tenant_id', tenantId)
    .gte('created_at', startOfMonth.toISOString())

  const monthlyRevenue = (revenueData || []).reduce(
    (sum, o) => sum + parseFloat(o.revenue || '0'), 0
  )

  // Show onboarding wizard only if:
  // 1. onboarding_completed_at is null (user hasn't dismissed it), AND
  // 2. All entity counts are zero (user hasn't created anything yet)
  // Once onboarding_completed_at is set (via dismiss button), the wizard
  // never reappears even if entities are later deleted.
  const showOnboarding = !tenant.onboarding_completed_at && truckCount === 0 && driverCount === 0 && orderCount === 0

  const userName = user.user_metadata?.full_name || 'there'
  const isTrialing = tenant.subscription_status === 'trialing'
  const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const daysRemaining = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-6">
      {showSetupBanner && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Account setup complete! Start by adding your first resources below.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {userName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here&apos;s what&apos;s happening with your fleet today.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
            <Truck className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{truckCount}</div>
            <p className="text-xs text-gray-500">
              {truckCount === 0 ? 'No trucks added yet' : `${truckCount} in fleet`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount}</div>
            <p className="text-xs text-gray-500">
              {orderCount === 0 ? 'No active loads' : `${orderCount} total orders`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drivers</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{driverCount}</div>
            <p className="text-xs text-gray-500">
              {driverCount === 0 ? 'No drivers added yet' : `${driverCount} drivers`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">
              {monthlyRevenue === 0 ? 'No revenue yet' : 'Month to date'}
            </p>
          </CardContent>
        </Card>
      </div>

      {showOnboarding ? (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Get Started with VroomX</CardTitle>
              <CardDescription>Complete these steps to start dispatching loads.</CardDescription>
            </div>
            {/* Dismiss button -- sets onboarding_completed_at so wizard never reappears */}
            <form action={async () => { 'use server'; const { dismissOnboarding } = await import('@/app/actions/onboarding'); await dismissOnboarding(); }}>
              <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
                Dismiss
              </button>
            </form>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Step 1: Add a driver */}
              <a href="/drivers" className="flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Add Your First Driver</p>
                  <p className="text-sm text-gray-500">Set up a driver with pay configuration</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </a>

              {/* Step 2: Add a truck */}
              <a href="/trucks" className="flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Truck className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Add Your First Truck</p>
                  <p className="text-sm text-gray-500">Register a vehicle in your fleet</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </a>

              {/* Step 3: Create an order */}
              <a href="/orders" className="flex items-center gap-4 rounded-lg border bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Create Your First Order</p>
                  <p className="text-sm text-gray-500">Start managing vehicle transport loads</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Plan and organization info for existing users */
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Plan</CardTitle>
              <CardDescription>Subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current plan</span>
                <span className="font-medium">{getTierDisplayName(tenant.plan)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeColor(tenant.subscription_status)}`}
                >
                  {tenant.subscription_status}
                </span>
              </div>
              {isTrialing && daysRemaining > 0 && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-900">
                    {daysRemaining} days remaining in your free trial
                  </p>
                  <p className="mt-1 text-xs text-blue-700">
                    No charges until {trialEndsAt?.toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Company information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Company name</span>
                <span className="font-medium">{tenant.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Your role</span>
                <span className="font-medium capitalize">{user.app_metadata?.role}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
