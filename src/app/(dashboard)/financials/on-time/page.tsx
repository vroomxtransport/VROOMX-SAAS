import { createClient } from '@/lib/supabase/server'
import {
  fetchOTDMetrics,
  fetchOTDByDriver,
  fetchOTDByBroker,
  fetchOTDTrend,
} from '@/lib/queries/on-time-analytics'
import type { OTDMetrics, OTDByDriver, OTDByBroker, OTDTrend } from '@/lib/queries/on-time-analytics'
import { OnTimeDashboard } from './_components/on-time-dashboard'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message: string }).message
          : 'Unknown error'
    console.warn(`[OTD] ${name} skipped:`, message)
    return fallback
  }
}

const EMPTY_METRICS: OTDMetrics = {
  totalDelivered: 0,
  onTimeCount: 0,
  lateCount: 0,
  earlyCount: 0,
  onTimeRate: 0,
  avgDaysVariance: 0,
}

export default async function OnTimePage() {
  const supabase = await createClient()

  const [initialMetrics, initialByDriver, initialByBroker, initialTrend] = await Promise.all([
    safeQuery<OTDMetrics>('fetchOTDMetrics', () => fetchOTDMetrics(supabase), EMPTY_METRICS),
    safeQuery<OTDByDriver[]>('fetchOTDByDriver', () => fetchOTDByDriver(supabase), []),
    safeQuery<OTDByBroker[]>('fetchOTDByBroker', () => fetchOTDByBroker(supabase), []),
    safeQuery<OTDTrend[]>('fetchOTDTrend', () => fetchOTDTrend(supabase, 6), []),
  ])

  return (
    <OnTimeDashboard
      initialMetrics={initialMetrics}
      initialByDriver={initialByDriver}
      initialByBroker={initialByBroker}
      initialTrend={initialTrend}
    />
  )
}
