import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/stat-card'
import { Truck, IdCard, Car, Activity, ChevronRight, BadgeDollarSign, CheckCircle2, Plus } from 'lucide-react'
import Link from 'next/link'
import { LoadsPipeline } from './_components/loads-pipeline'
import { RevenueChart } from './_components/revenue-chart'
import { FleetPulse } from './_components/fleet-pulse'
import { UpcomingPickups } from './_components/upcoming-pickups'
import { ActivityFeed } from './_components/activity-feed'
import { CustomizeDashboard } from './_components/customize-dashboard'
import { DashboardWidgets } from './_components/dashboard-widgets'
import { RolePresetSelector } from './_components/role-preset-selector'
import { OpenInvoices } from './_components/open-invoices'
import { TopDrivers } from './_components/top-drivers'
import { QuickLinks } from './_components/quick-links'

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

  // Fetch month-to-date revenue + previous month for trend comparison
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const startOfPrevMonth = new Date(startOfMonth)
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1)

  const [
    { data: revenueData },
    { data: prevRevenueData },
    milesResult,
    prevMilesResult,
    prevActiveResult,
    prevInTransitResult,
  ] = await Promise.all([
    supabase.from('orders').select('revenue').eq('tenant_id', tenantId).gte('created_at', startOfMonth.toISOString()),
    supabase.from('orders').select('revenue').eq('tenant_id', tenantId).gte('created_at', startOfPrevMonth.toISOString()).lt('created_at', startOfMonth.toISOString()),
    supabase.from('orders').select('distance_miles').eq('tenant_id', tenantId).gte('created_at', startOfMonth.toISOString()).not('distance_miles', 'is', null),
    supabase.from('orders').select('distance_miles, revenue').eq('tenant_id', tenantId).gte('created_at', startOfPrevMonth.toISOString()).lt('created_at', startOfMonth.toISOString()).not('distance_miles', 'is', null),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['new', 'assigned', 'picked_up']).gte('created_at', startOfPrevMonth.toISOString()).lt('created_at', startOfMonth.toISOString()),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'picked_up').gte('created_at', startOfPrevMonth.toISOString()).lt('created_at', startOfMonth.toISOString()),
  ])

  const monthlyRevenue = (revenueData || []).reduce(
    (sum, o) => sum + parseFloat(o.revenue || '0'), 0
  )
  const prevMonthlyRevenue = (prevRevenueData || []).reduce(
    (sum, o) => sum + parseFloat(o.revenue || '0'), 0
  )

  let totalMiles = 0
  if (!milesResult.error && milesResult.data) {
    totalMiles = milesResult.data.reduce(
      (sum, o) => sum + parseFloat(o.distance_miles || '0'), 0
    )
  }

  let prevTotalMiles = 0
  let prevMonthRevForMiles = 0
  if (!prevMilesResult.error && prevMilesResult.data) {
    prevTotalMiles = prevMilesResult.data.reduce(
      (sum, o) => sum + parseFloat(o.distance_miles || '0'), 0
    )
    prevMonthRevForMiles = prevMilesResult.data.reduce(
      (sum, o) => sum + parseFloat(o.revenue || '0'), 0
    )
  }

  const avgPerMile = totalMiles > 0 ? monthlyRevenue / totalMiles : 0
  const prevAvgPerMile = prevTotalMiles > 0 ? prevMonthRevForMiles / prevTotalMiles : 0

  const prevActiveLoads = prevActiveResult.count ?? 0
  const prevInTransit = prevInTransitResult.count ?? 0

  function trendPct(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const activeLoadsTrend = trendPct(activeLoads, prevActiveLoads)
  const inTransitTrend = trendPct(inTransit, prevInTransit)
  const revenueTrend = trendPct(monthlyRevenue, prevMonthlyRevenue)
  const perMileTrend = trendPct(avgPerMile, prevAvgPerMile)

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

  // Fetch 5 most recent orders for pipeline widget
  const { data: recentOrdersRaw } = await supabase
    .from('orders')
    .select('order_number, vehicles, vehicle_year, vehicle_make, vehicle_model, pickup_city, pickup_state, delivery_city, delivery_state, status, revenue')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5)

  const recentOrders = (recentOrdersRaw || []).map((o) => {
    const vehicles = o.vehicles as Array<{ year?: number; make?: string; model?: string }> | null
    const firstVehicle = vehicles?.[0]
    const vehicle = firstVehicle
      ? [firstVehicle.year, firstVehicle.make, firstVehicle.model].filter(Boolean).join(' ')
      : [o.vehicle_year, o.vehicle_make, o.vehicle_model].filter(Boolean).join(' ') || 'N/A'
    const origin = [o.pickup_city, o.pickup_state].filter(Boolean).join(', ') || 'N/A'
    const dest = [o.delivery_city, o.delivery_state].filter(Boolean).join(', ') || 'N/A'
    return {
      orderNumber: o.order_number || 'N/A',
      vehicle,
      route: `${origin} → ${dest}`,
      status: o.status || 'new',
      revenue: parseFloat(o.revenue || '0'),
    }
  })

  // Fetch upcoming pickups (assigned/new orders with future pickup dates)
  const todayStr = new Date().toISOString().split('T')[0]
  const { data: pickupsRaw } = await supabase
    .from('orders')
    .select('order_number, vehicles, vehicle_year, vehicle_make, vehicle_model, pickup_city, pickup_state, pickup_date, driver:drivers(first_name, last_name)')
    .eq('tenant_id', tenantId)
    .in('status', ['new', 'assigned'])
    .gte('pickup_date', todayStr)
    .order('pickup_date', { ascending: true })
    .limit(10)

  const upcomingPickups = (pickupsRaw || []).map((o) => {
    const vehicles = o.vehicles as Array<{ year?: number; make?: string; model?: string }> | null
    const firstVehicle = vehicles?.[0]
    const vehicle = firstVehicle
      ? [firstVehicle.year, firstVehicle.make, firstVehicle.model].filter(Boolean).join(' ')
      : [o.vehicle_year, o.vehicle_make, o.vehicle_model].filter(Boolean).join(' ') || 'N/A'
    const driverArr = o.driver as unknown as Array<{ first_name: string; last_name: string }> | null
    const driver = driverArr?.[0] ?? null
    const driverName = driver ? `${driver.first_name} ${driver.last_name}` : null
    return {
      orderNumber: o.order_number || 'N/A',
      vehicle,
      location: [o.pickup_city, o.pickup_state].filter(Boolean).join(', ') || 'N/A',
      driverName,
      pickupDate: o.pickup_date ? new Date(o.pickup_date).toISOString() : new Date().toISOString(),
    }
  })

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
      icon: IdCard,
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
      icon: Car,
      title: 'Create Your First Order',
      description: 'Start managing vehicle transport loads',
      done: orderCount > 0,
    },
  ]
  const completedSteps = onboardingSteps.filter((s) => s.done).length

  const fleetData = {
    trucks: { active: activeTrucks ?? 0, total: truckCount },
    drivers: { onTrip: driversOnTrip ?? 0, total: driverCount },
    capacity: { used: inTransit, total: activeLoads || inTransit },
  }

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const fullDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-4">
      {showSetupBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Account setup complete! Start by adding your first resources below.
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl text-foreground">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome back, {userName}! Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="hidden sm:inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
            {fullDate}
          </span>
          {orderCount > 0 && (
            <>
              <span className="stat-pill">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
                </span>
                {activeLoads} active
              </span>
              <span className="stat-pill">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {inTransit} transit
              </span>
            </>
          )}
          <RolePresetSelector />
          <Button asChild size="sm" className="!text-white">
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

      {/* Onboarding card (if needed) */}
      {showOnboarding && (
        <Card className="rounded-xl border-brand/20 bg-gradient-to-br from-surface to-[var(--accent-blue-bg)] overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)] to-[#2a3a4f]">
                  <Car className="h-4.5 w-4.5 text-white" />
                </div>
                <CardTitle>Get Started with VroomX</CardTitle>
              </div>
              <CardDescription>Complete these steps to start dispatching loads.</CardDescription>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-border-subtle overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[var(--brand)] to-[#2a3a4f] transition-all duration-500"
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
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${step.done ? 'bg-emerald-100' : 'bg-[var(--accent-blue-bg)]'}`}>
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
                    <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
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
            <StatCard label="Active Loads" value={activeLoads} icon={Car} accent="blue" trend={activeLoadsTrend !== 0 ? { value: activeLoadsTrend, label: 'vs last month' } : undefined} />
            <StatCard label="In-Transit" value={inTransit} icon={Truck} accent="amber" trend={inTransitTrend !== 0 ? { value: inTransitTrend, label: 'vs last month' } : undefined} />
            <StatCard label="Revenue MTD" value={`$${monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`} icon={Activity} accent="emerald" trend={revenueTrend !== 0 ? { value: revenueTrend, label: 'vs last month' } : undefined} />
            <StatCard label="Avg $/Mile" value={`$${avgPerMile.toFixed(2)}`} icon={BadgeDollarSign} accent="violet" trend={perMileTrend !== 0 ? { value: perMileTrend, label: 'vs last month' } : undefined} />
          </div>
        }
        loadsPipeline={
          <LoadsPipeline
            pipelineCounts={pipelineCounts}
            recentOrders={recentOrders}
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
        upcomingPickups={<UpcomingPickups pickups={upcomingPickups} />}
        activityFeed={<ActivityFeed />}
        openInvoices={<OpenInvoices />}
        topDrivers={<TopDrivers />}
        quickLinks={<QuickLinks />}
      />
    </div>
  )
}
