import { createClient } from '@/lib/supabase/server'
import { fetchMonthlyKPITrend } from '@/lib/queries/financials'
import type { MonthlyKPITrend } from '@/lib/queries/financials'
import { ForecastDashboard } from './_components/forecast-dashboard'

// Safe wrapper — mirrors the pattern used in the parent financials page
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
    console.warn(`[Forecast] ${name} skipped:`, message)
    return fallback
  }
}

export default async function ForecastPage() {
  const supabase = await createClient()

  // Fetch last 12 months to give the forecasting engine maximum historical context
  const kpiTrend = await safeQuery<MonthlyKPITrend[]>(
    'fetchMonthlyKPITrend',
    () => fetchMonthlyKPITrend(supabase, 12),
    []
  )

  return <ForecastDashboard kpiTrend={kpiTrend} />
}
