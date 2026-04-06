import { createClient } from '@/lib/supabase/server'
import { fetchCustomReports } from '@/lib/queries/reports'
import type { SavedReport } from '@/lib/reports/report-config'
import { PageHeader } from '@/components/shared/page-header'
import { ReportsList } from './_components/reports-list'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[Reports] ${name} skipped:`, message)
    return fallback
  }
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const reports = await safeQuery<SavedReport[]>('fetchCustomReports', () => fetchCustomReports(supabase), [])

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Your saved custom reports" />
      <ReportsList initialReports={reports} />
    </div>
  )
}
