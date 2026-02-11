import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetupCompleteBanner } from './setup-complete-banner'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, Users, Package, TrendingUp } from 'lucide-react'

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
    .select('name, plan, subscription_status, trial_ends_at')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    redirect('/login')
  }

  const userName = user.user_metadata?.full_name || 'there'
  const isTrialing = tenant.subscription_status === 'trialing'
  const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const daysRemaining = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-6">
      {showSetupBanner && <SetupCompleteBanner />}

      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {userName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening with your fleet today.
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">No trucks added yet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loads</CardTitle>
            <Package className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">No active loads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drivers</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-500">No drivers added yet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (MTD)</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0</div>
            <p className="text-xs text-gray-500">No revenue yet</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan and organization info */}
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

      {/* Quick start guide */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
          <CardDescription>Get started with VroomX in a few simple steps</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                1
              </span>
              <div>
                <p className="font-medium text-gray-900">Add your trucks</p>
                <p className="text-sm text-gray-600">
                  Go to Trucks and add your fleet vehicles
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                2
              </span>
              <div>
                <p className="font-medium text-gray-900">Add drivers</p>
                <p className="text-sm text-gray-600">
                  Invite your drivers to the platform
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                3
              </span>
              <div>
                <p className="font-medium text-gray-900">Create your first load</p>
                <p className="text-sm text-gray-600">
                  Start managing loads and dispatching trucks
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
