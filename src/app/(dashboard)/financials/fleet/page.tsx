import { createClient } from '@/lib/supabase/server'
import { fetchFleetUtilization, computeFleetSummary } from '@/lib/queries/fleet-utilization'
import type { TruckUtilization, FleetSummary } from '@/lib/queries/fleet-utilization'
import { FleetUtilizationDashboard } from './_components/fleet-utilization-dashboard'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message: string }).message
          : 'Unknown error (likely auth context unavailable during SSR)'
    console.warn(`[FleetUtilization] ${name} skipped:`, message)
    return fallback
  }
}

const EMPTY_SUMMARY: FleetSummary = {
  totalTrucks: 0,
  activeTrucks: 0,
  avgUtilization: 0,
  totalRevenue: 0,
  totalProfit: 0,
  revenuePerTruck: 0,
  profitPerTruck: 0,
  totalMiles: 0,
}

export default async function FleetUtilizationPage() {
  const supabase = await createClient()

  const initialTrucks = await safeQuery<TruckUtilization[]>(
    'fetchFleetUtilization',
    () => fetchFleetUtilization(supabase),
    []
  )

  const initialSummary: FleetSummary =
    initialTrucks.length > 0 ? computeFleetSummary(initialTrucks) : EMPTY_SUMMARY

  return (
    <FleetUtilizationDashboard
      initialTrucks={initialTrucks}
      initialSummary={initialSummary}
    />
  )
}
