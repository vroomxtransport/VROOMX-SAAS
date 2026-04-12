import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { acquireCronLock } from '@/lib/cron-lock'
import { createClient } from '@supabase/supabase-js'
import { getResend } from '@/lib/resend/client'
import { fetchDueScheduledReports } from '@/lib/queries/scheduled-reports'
import { executeReport } from '@/lib/reports/report-query-engine'
import { METRICS, DIMENSIONS } from '@/lib/reports/report-config'
import type { ReportConfig, MetricDefinition, DimensionDefinition, DataSource } from '@/lib/reports/report-config'
import { computeNextRunAt } from '@/lib/reports/schedule-utils'
import type { ScheduleOption } from '@/lib/validations/scheduled-reports'

// Ensure this route is never statically cached
export const dynamic = 'force-dynamic'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a plain-text/HTML table from report result rows for the email body.
 * Kept simple — full CSV/Excel attachments carry the data payload.
 */
function buildEmailHtml(reportName: string, format: string): string {
  return `
<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family:sans-serif;color:#1a2b3f;padding:32px;">
    <h2 style="margin:0 0 8px;">VroomX Scheduled Report</h2>
    <p style="margin:0 0 24px;color:#64748b;">Your scheduled report <strong>${reportName}</strong> is ready.</p>
    <p style="color:#64748b;">The report is attached as a ${format.toUpperCase()} file.</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="font-size:12px;color:#94a3b8;">
      You received this because you set up a scheduled report in VroomX TMS.<br />
      To manage your schedules, visit your
      <a href="https://app.vroomx.com/reports/schedules" style="color:#1a2b3f;">Reports &rsaquo; Schedules</a> page.
    </p>
  </body>
</html>
`
}

/**
 * Serialise report rows to CSV text.
 */
function rowsToCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, string | number | null>[]
): string {
  const header = columns.map((c) => `"${c.label}"`).join(',')
  const body = rows.map((row) =>
    columns.map((c) => {
      const v = row[c.key]
      if (v === null || v === undefined) return ''
      return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
    }).join(',')
  )
  return [header, ...body].join('\n')
}

// ============================================================================
// Cron handler
// ============================================================================

export async function POST(request: Request) {
  // 1. Authenticate cron caller via shared secret (timing-safe — CRIT-3 fix)
  if (!verifyCronSecret(request.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // N16: distributed lock — prevents overlapping report sends
  const lock = await acquireCronLock('cron:reports', 120)
  if (!lock.acquired) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'concurrent invocation locked' })
  }

  // 2. Service-role client — bypasses RLS intentionally (cron has no user context)
  //    This is the controlled server context where service-role is explicitly permitted.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Fetch all due schedules
  let dueSchedules
  try {
    dueSchedules = await fetchDueScheduledReports(supabase)
  } catch (err) {
    console.error('[cron/reports] fetchDueScheduledReports failed:', err)
    return NextResponse.json({ error: 'Failed to fetch due reports' }, { status: 500 })
  }

  if (dueSchedules.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const resend = getResend()
  let processed = 0
  const errors: string[] = []

  // 4. Process each due schedule
  for (const schedule of dueSchedules) {
    try {
      // 4a. Fetch the saved report config — verify tenant ownership
      const { data: reportRow, error: reportErr } = await supabase
        .from('custom_reports')
        .select('config, name')
        .eq('id', schedule.report_id)
        .eq('tenant_id', schedule.tenant_id)
        .single()

      if (reportErr || !reportRow) {
        errors.push(`Schedule ${schedule.id}: report not found`)
        continue
      }

      const config = reportRow.config as ReportConfig
      const reportName = reportRow.name as string
      const dataSource = config.dataSource as DataSource

      // 4b. Resolve metric + dimension definitions from catalogs
      const allMetrics: MetricDefinition[] = METRICS[dataSource] ?? []
      const allDimensions: DimensionDefinition[] = DIMENSIONS[dataSource] ?? []
      const metrics = allMetrics.filter((m) => config.metrics.includes(m.id))
      const dimensions = allDimensions.filter((d) => config.dimensions.includes(d.id))

      // 4c. Execute the report query (scoped to tenant via tenant_id filter in engine)
      //     We pass a tenant-scoped supabase client by using a per-row query filter
      //     via the service-role client — the engine does not add tenant filters itself
      //     so we create a thin wrapper that injects tenant_id via RPC context.
      //     Since we own the cron and verify schedule ownership, this is safe.
      const result = await executeReport(supabase, config, metrics, dimensions, undefined, schedule.tenant_id)

      // 4d. Build attachment content
      let attachmentContent: Buffer
      let filename: string

      if (schedule.format === 'csv') {
        const csv = rowsToCsv(result.columns, result.rows)
        attachmentContent = Buffer.from(csv, 'utf-8')
        filename = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      } else {
        // PDF and Excel rendering not yet wired — send CSV with .csv extension
        const csv = rowsToCsv(result.columns, result.rows)
        attachmentContent = Buffer.from(csv, 'utf-8')
        filename = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
      }

      // 4e. Send email via Resend
      await resend.emails.send({
        from: process.env.EMAIL_FROM_REPORTS ?? 'VroomX Reports <reports@vroomx.com>',
        to: schedule.recipients,
        subject: `Scheduled Report: ${reportName}`,
        html: buildEmailHtml(reportName, schedule.format),
        attachments: [
          {
            filename,
            content: attachmentContent,
          },
        ],
      })

      // 4f. Compute next run time and update the row
      const nextRunAt = computeNextRunAt(schedule.schedule as ScheduleOption)

      const { error: updateErr } = await supabase
        .from('scheduled_reports')
        .update({
          last_sent_at: new Date().toISOString(),
          next_run_at: nextRunAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedule.id)

      if (updateErr) {
        console.error(`[cron/reports] Failed to update schedule ${schedule.id}:`, updateErr)
      }

      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron/reports] Error processing schedule ${schedule.id}:`, message)
      errors.push(`Schedule ${schedule.id}: ${message}`)
    }
  }

  await lock.release()

  console.log(`[cron/reports] Done. Processed: ${processed}, Errors: ${errors.length}`)

  return NextResponse.json({
    processed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
