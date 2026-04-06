import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface ScheduledReportRow {
  id: string
  tenant_id: string
  user_id: string
  report_id: string
  schedule: string
  recipients: string[]
  format: string
  enabled: boolean
  last_sent_at: string | null
  next_run_at: string | null
  created_at: string
  updated_at: string
  // Joined from custom_reports
  report_name: string | null
}

// The shape Supabase returns when we do a nested select on custom_reports
interface RawRow {
  id: string
  tenant_id: string
  user_id: string
  report_id: string
  schedule: string
  recipients: unknown
  format: string
  enabled: boolean
  last_sent_at: string | null
  next_run_at: string | null
  created_at: string
  updated_at: string
  custom_reports: { name: string } | null
}

function normalise(row: RawRow): ScheduledReportRow {
  return {
    ...row,
    recipients: Array.isArray(row.recipients) ? (row.recipients as string[]) : [],
    report_name: row.custom_reports?.name ?? null,
  }
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetch all scheduled reports for the authenticated tenant (user-context client).
 * Joins custom_reports to embed the report name.
 */
export async function fetchScheduledReports(
  supabase: SupabaseClient
): Promise<ScheduledReportRow[]> {
  const { data, error } = await supabase
    .from('scheduled_reports')
    .select('*, custom_reports(name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as RawRow[]).map(normalise)
}

/**
 * Fetch scheduled reports that are due to run now.
 * Intended for use in the cron handler with the service-role client.
 * Returns all tenants' due schedules — the cron route processes them all.
 */
export async function fetchDueScheduledReports(
  supabase: SupabaseClient
): Promise<ScheduledReportRow[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('scheduled_reports')
    .select('*, custom_reports(name)')
    .eq('enabled', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as RawRow[]).map(normalise)
}
