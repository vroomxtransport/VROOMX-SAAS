import { createClient } from '@/lib/supabase/server'
import { fetchTripAnalytics } from '@/lib/queries/financials'
import type { TripAnalyticsRow } from '@/lib/queries/financials'
import { TripAnalyticsDashboard } from '../_components/trip-analytics-dashboard'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[TripAnalytics] ${name} failed:`, err)
    return fallback
  }
}

export default async function TripAnalyticsPage() {
  const supabase = await createClient()

  const trips = await safeQuery<TripAnalyticsRow[]>(
    'fetchTripAnalytics',
    () => fetchTripAnalytics(supabase, 'mtd'),
    []
  )

  return <TripAnalyticsDashboard initialTrips={trips} />
}
