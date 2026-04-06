import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import {
  fetchDriverPerformance,
  computeDriverSummary,
} from '@/lib/queries/driver-scorecard'
import type { DriverPerformance, DriverSummary } from '@/lib/queries/driver-scorecard'
import { DriverPerformanceDashboard } from './_components/driver-performance-dashboard'

export const metadata = {
  title: 'Driver Performance | VroomX',
}

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
    console.warn(`[DriverPerformance] ${name} skipped:`, message)
    return fallback
  }
}

export default async function DriverPerformancePage() {
  const supabase = await createClient()

  const [initialDrivers] = await Promise.all([
    safeQuery<DriverPerformance[]>(
      'fetchDriverPerformance',
      () => fetchDriverPerformance(supabase),
      []
    ),
  ])

  const initialSummary: DriverSummary = computeDriverSummary(initialDrivers)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Driver Performance"
        subtitle="Track driver efficiency, profitability, and on-time delivery rates"
      />
      <DriverPerformanceDashboard
        initialDrivers={initialDrivers}
        initialSummary={initialSummary}
      />
    </div>
  )
}
