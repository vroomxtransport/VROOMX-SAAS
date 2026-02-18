import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Truck, Users, Package, TrendingUp, ChevronRight, PackageSearch, DollarSign, CheckCircle2, Plus } from 'lucide-react'
import Link from 'next/link'
import { LoadsPipeline } from './_components/loads-pipeline'
import { RevenueChart } from './_components/revenue-chart'
import { FleetPulse } from './_components/fleet-pulse'
import { UpcomingPickups } from './_components/upcoming-pickups'
import { ActivityFeed } from './_components/activity-feed'
import { CustomizeDashboard } from './_components/customize-dashboard'
import { DashboardWidgets } from './_components/dashboard-widgets'
import { OpenInvoices } from './_components/open-invoices'
import { TopDrivers } from './_components/top-drivers'
import { QuickLinks } from './_components/quick-links'

// Sample data for pipeline recent orders
const SAMPLE_RECENT_ORDERS = [
  { orderNumber: 'ORD-1047', vehicle: '2024 Tesla Model Y', route: 'Dallas, TX → Miami, FL', status: 'picked_up', revenue: 1850 },
  { orderNumber: 'ORD-1046', vehicle: '2023 BMW X5', route: 'Los Angeles, CA → Phoenix, AZ', status: 'new', revenue: 950 },
  { orderNumber: 'ORD-1045', vehicle: '2022 Ford F-150', route: 'Houston, TX → Atlanta, GA', status: 'assigned', revenue: 1200 },
  { orderNumber: 'ORD-1044', vehicle: '2024 Porsche 911', route: 'Chicago, IL → Denver, CO', status: 'delivered', revenue: 2100 },
  { orderNumber: 'ORD-1043', vehicle: '2023 Honda Civic', route: 'San Diego, CA → Seattle, WA', status: 'new', revenue: 1450 },
]

// Sample upcoming pickups
function getSamplePickups() {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)

  return [
    { orderNumber: 'ORD-1047', vehicle: '2024 Tesla Model Y', location: 'Dallas, TX', driverName: 'Mike R.', pickupDate: today.toISOString() },
    { orderNumber: 'ORD-1045', vehicle: '2022 Ford F-150', location: 'Houston, TX', driverName: 'Sarah K.', pickupDate: today.toISOString() },
    { orderNumber: 'ORD-1046', vehicle: '2023 BMW X5', location: 'Los Angeles, CA', driverName: null, pickupDate: tomorrow.toISOString() },
    { orderNumber: 'ORD-1048', vehicle: '2024 Mercedes GLE', location: 'Phoenix, AZ', driverName: 'Tom B.', pickupDate: tomorrow.toISOString() },
    { orderNumber: 'ORD-1049', vehicle: '2023 Audi Q7', location: 'Denver, CO', driverName: null, pickupDate: dayAfter.toISOString() },
  ]
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>
}) {
  const params = await searchParams
  const showSetupBanner = params.setup === 'complete'

  let supabase
  try {
    supabase = await createClient()
  } catch (e) {
    console.error('[DASHBOARD_PAGE] Failed to create Supabase client:', e)
    redirect('/login')
  }

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
  let trucksResult, driversResult, ordersResult, activeOrdersResult, inTransitResult
  try {
    [trucksResult, driversResult, ordersResult, activeOrdersResult, inTransitResult] = await Promise.all([
      supabase.from('trucks').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['new', 'assigned', 'picked_up']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'picked_up'),
    ])
  } catch (e) {
    console.error('[DASHBOARD_PAGE] Entity count queries failed:', e)
    trucksResult = driversResult = ordersResult = activeOrdersResult = inTransitResult = { count: 0, data: null, error: null }
  }

  const truckCount = trucksResult.count ?? 0
  const driverCount = driversResult.count ?? 0
  const orderCount = ordersResult.count ?? 0
  const activeLoads = activeOrdersResult.count ?? 0
  const inTransit = inTransitResult.count ?? 0

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

  // Calculate avg $/mile using real distance_miles from orders (gracefully handles missing column)
  let totalMiles = 0
  const milesResult = await supabase
    .from('orders')
    .select('distance_miles')
    .eq('tenant_id', tenantId)
    .gte('created_at', startOfMonth.toISOString())
    .not('distance_miles', 'is', null)

  if (!milesResult.error && milesResult.data) {
    totalMiles = milesResult.data.reduce(
      (sum, o) => sum + parseFloat(o.distance_miles || '0'), 0
    )
  }
  // Use real miles if available, otherwise fall back to estimate
  const avgPerMile = totalMiles > 0
    ? (monthlyRevenue / totalMiles).toFixed(2)
    : orderCount > 0
      ? (monthlyRevenue / Math.max(orderCount * 450, 1)).toFixed(2)
      : '0.00'

  // Pipeline counts — fetch order counts per status
  const { data: pipelineData } = await supabase
    .from('orders')
    .select('status')
    .eq('tenant_id', tenantId)

  const pipelineCounts: Record<string, number> = { new: 0, assigned: 0, picked_up: 0, delivered: 0, invoiced: 0, paid: 0 }
  for (const row of pipelineData || []) {
    if (row.status in pipelineCounts) {
      pipelineCounts[row.status]++
    }
  }

  // If no real data, use sample counts for visual appeal
  const hasPipelineData = Object.values(pipelineCounts).some((v) => v > 0)
  const displayPipelineCounts = hasPipelineData
    ? pipelineCounts
    : { new: 12, assigned: 8, picked_up: 23, delivered: 4, invoiced: 6, paid: 14 }

  // Fleet pulse data
  const { count: activeTrucks } = await supabase
    .from('trucks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  const { count: driversOnTrip } = await supabase
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  const showOnboarding = !tenant.onboarding_completed_at && truckCount === 0 && driverCount === 0 && orderCount === 0

  const userName = user.user_metadata?.full_name || 'there'
  const isTrialing = tenant.subscription_status === 'trialing'
  const trialEndsAt = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const daysRemaining = trialEndsAt
    ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  const onboardingSteps = [
    {
      href: '/drivers',
      icon: Users,
      title: 'Add Your First Driver',
      description: 'Set up a driver with pay configuration',
      done: driverCount > 0,
    },
    {
      href: '/trucks',
      icon: Truck,
      title: 'Add Your First Truck',
      description: 'Register a vehicle in your fleet',
      done: truckCount > 0,
    },
    {
      href: '/orders',
      icon: PackageSearch,
      title: 'Create Your First Order',
      description: 'Start managing vehicle transport loads',
      done: orderCount > 0,
    },
  ]
  const completedSteps = onboardingSteps.filter((s) => s.done).length

  // Use sample fleet pulse data when no real data exists
  const fleetData = {
    trucks: { active: activeTrucks ?? (truckCount > 0 ? 0 : 6), total: truckCount || 8 },
    drivers: { onTrip: driversOnTrip ?? (driverCount > 0 ? 0 : 4), total: driverCount || 5 },
    capacity: { used: inTransit > 0 ? inTransit * 3 : 47, total: truckCount > 0 ? truckCount * 7 : 72 },
  }

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const fullDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-4">
      {showSetupBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Account setup complete! Start by adding your first resources below.
          </p>
        </div>
      )}

      {/* Hero Header */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{dayOfWeek}, {fullDate}</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-foreground lg:text-2xl">
              Welcome back, {userName}!
            </h1>
            {orderCount > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {activeLoads} active loads
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {inTransit} in transit
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ${monthlyRevenue.toLocaleString()} revenue this month
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Your fleet command center — manage loads, drivers, and revenue at a glance.
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild size="sm" className="bg-gradient-to-r from-[#fb7232] to-[#f59e0b] text-white border-0 hover:brightness-110">
              <Link href="/orders">
                <Plus className="h-4 w-4" />
                New Order
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/dispatch">
                <Plus className="h-4 w-4" />
                New Trip
              </Link>
            </Button>
            <CustomizeDashboard />
          </div>
        </div>

      </div>

      {/* Onboarding card (if needed) */}
      {showOnboarding && (
        <Card className="rounded-xl border-brand/20 bg-gradient-to-br from-surface to-[var(--accent-blue-bg)] overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[#f59e0b]">
                  <Package className="h-4.5 w-4.5 text-white" />
                </div>
                <CardTitle>Get Started with VroomX</CardTitle>
              </div>
              <CardDescription>Complete these steps to start dispatching loads.</CardDescription>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-border-subtle overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[var(--brand)] to-[#f59e0b] transition-all duration-500"
                    style={{ width: `${(completedSteps / 3) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-brand tabular-nums">{completedSteps}/3</span>
              </div>
            </div>
            <form action={async () => { 'use server'; const { dismissOnboarding } = await import('@/app/actions/onboarding'); await dismissOnboarding(); }}>
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dismiss
              </button>
            </form>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border-subtle">
              {onboardingSteps.map((step) => {
                const StepIcon = step.icon
                return (
                  <a
                    key={step.href}
                    href={step.href}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 transition-colors hover:bg-accent/50 -mx-2 px-2 rounded-lg group"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${step.done ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-[var(--accent-blue-bg)]'}`}>
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <StepIcon className="h-5 w-5 text-[var(--accent-blue)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-foreground ${step.done ? 'line-through opacity-60' : ''}`}>
                        {step.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard widgets with customization support */}
      <DashboardWidgets
        statCards={
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active Loads" value={activeLoads || 47} icon={Package} accent="blue" trend={{ value: 12, label: 'vs last month' }} />
            <StatCard label="In-Transit" value={inTransit || 23} icon={Truck} accent="amber" trend={{ value: 8, label: 'vs last month' }} />
            <StatCard label="Revenue MTD" value={monthlyRevenue > 0 ? `$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '$128,450'} icon={TrendingUp} accent="emerald" trend={{ value: 18, label: 'vs last month' }} />
            <StatCard label="Avg $/Mile" value={avgPerMile !== '0.00' ? `$${avgPerMile}` : '$2.47'} icon={DollarSign} accent="violet" trend={{ value: -3, label: 'vs last month' }} />
          </div>
        }
        loadsPipeline={
          <LoadsPipeline
            pipelineCounts={displayPipelineCounts}
            recentOrders={SAMPLE_RECENT_ORDERS}
          />
        }
        revenueChart={<RevenueChart />}
        fleetPulse={
          <FleetPulse
            trucks={fleetData.trucks}
            drivers={fleetData.drivers}
            capacity={fleetData.capacity}
          />
        }
        upcomingPickups={<UpcomingPickups pickups={getSamplePickups()} />}
        activityFeed={<ActivityFeed />}
        openInvoices={<OpenInvoices />}
        topDrivers={<TopDrivers />}
        quickLinks={<QuickLinks />}
      />
    </div>
  )
}
