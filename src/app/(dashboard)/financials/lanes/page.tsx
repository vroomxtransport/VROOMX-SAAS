import { createClient } from '@/lib/supabase/server'
import { fetchLaneProfitability } from '@/lib/queries/lane-analytics'
import type { LaneProfitability } from '@/lib/queries/lane-analytics'
import { LaneProfitabilityDashboard } from './_components/lane-profitability-dashboard'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? (err as { message: string }).message
        : 'Unknown error'
    console.warn(`[LaneAnalytics] ${name} skipped:`, message)
    return fallback
  }
}

export default async function LaneAnalyticsPage() {
  const supabase = await createClient()

  const lanes = await safeQuery<LaneProfitability[]>(
    'fetchLaneProfitability',
    () => fetchLaneProfitability(supabase),
    []
  )

  return <LaneProfitabilityDashboard initialLanes={lanes} />
}
