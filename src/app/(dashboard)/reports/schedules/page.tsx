import { createClient } from '@/lib/supabase/server'
import { fetchScheduledReports } from '@/lib/queries/scheduled-reports'
import { fetchCustomReports } from '@/lib/queries/reports'
import { PageHeader } from '@/components/shared/page-header'
import { SchedulesList } from './_components/schedules-list'
import type { ScheduledReportRow } from '@/lib/queries/scheduled-reports'
import type { SavedReport } from '@/lib/reports/report-config'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[Schedules] ${name} skipped:`, message)
    return fallback
  }
}

export default async function SchedulesPage() {
  const supabase = await createClient()

  const [schedules, reports] = await Promise.all([
    safeQuery<ScheduledReportRow[]>('fetchScheduledReports', () => fetchScheduledReports(supabase), []),
    safeQuery<SavedReport[]>('fetchCustomReports', () => fetchCustomReports(supabase), []),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Reports"
        subtitle="Automatically deliver reports to your inbox on a schedule"
      />
      <SchedulesList initialSchedules={schedules} availableReports={reports} />
    </div>
  )
}
