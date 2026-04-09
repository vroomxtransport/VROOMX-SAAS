// ============================================================================
// Cron Route: Audit Log Archival
// POST /api/cron/archive-audit-logs
//
// Triggered by a cron scheduler (e.g. Vercel Cron, GitHub Actions) on a
// daily or weekly schedule. Secured by CRON_SECRET header.
//
// Flow per tenant:
//   1. Find tenant_ids with audit_logs older than ARCHIVE_THRESHOLD_DAYS
//   2. For each tenant, determine complete calendar months to archive
//   3. For each month (idempotent — skip if audit_archives record exists):
//      a. Paginate all rows for that month from audit_logs
//      b. Apply redactPii() to each row's metadata field
//      c. Serialize to JSON, compute SHA-256 checksum
//      d. Upload to Supabase Storage bucket "audit-archives"
//      e. Verify upload succeeded (createSignedUrl probe)
//      f. Insert metadata record into audit_archives
//      g. Delete archived rows from audit_logs (service-role bypasses RLS)
//
// The audit_logs table is append-only for authenticated users (no DELETE RLS
// policy). Only this cron — running with the service-role client — may delete.
//
// Storage bucket "audit-archives" must be created via the Supabase dashboard
// before this cron runs. The cron handles upload errors gracefully if the
// bucket does not yet exist.
// ============================================================================

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { redactPii } from '@/lib/audit-redact'

export const dynamic = 'force-dynamic'

// Logs older than this are eligible for archival
const ARCHIVE_THRESHOLD_DAYS = 90
// Rows fetched per paginated batch when building the archive payload
const BATCH_SIZE = 1000
// Max distinct tenants processed per invocation (guard for large deploys)
const MAX_TENANTS = 500
// Storage bucket name — must be created in Supabase dashboard first
const BUCKET = 'audit-archives'

export async function POST(req: Request) {
  // Authenticate the cron caller (timing-safe comparison via cron-auth)
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS)
  const cutoffIso = cutoffDate.toISOString()

  const results = {
    tenantsProcessed: 0,
    archivesCreated: 0,
    rowsArchived: 0,
    errors: 0,
  }

  // ----- 1. Find distinct tenant_ids that have archivable audit logs -----
  const { data: tenantRows, error: tenantErr } = await supabase
    .from('audit_logs')
    .select('tenant_id')
    .lt('created_at', cutoffIso)
    .limit(MAX_TENANTS)

  if (tenantErr) {
    console.error('[cron/archive-audit-logs] Failed to find tenant IDs:', tenantErr.message)
    return NextResponse.json({ error: 'Failed to find tenants' }, { status: 500 })
  }

  const tenantIds = [...new Set((tenantRows ?? []).map((r) => r.tenant_id as string))]

  // ----- 2. Process each tenant independently -----
  for (const tenantId of tenantIds) {
    try {
      // Find the oldest archivable log to determine which months to process
      const { data: oldestRows, error: oldestErr } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .lt('created_at', cutoffIso)
        .order('created_at', { ascending: true })
        .limit(1)

      if (oldestErr || !oldestRows?.length) continue

      const oldestDate = new Date(oldestRows[0].created_at as string)

      // Build list of complete calendar months between oldest log and the
      // cutoff month (exclusive — the cutoff month may not be complete yet)
      const months: string[] = []
      const cursor = new Date(Date.UTC(oldestDate.getUTCFullYear(), oldestDate.getUTCMonth(), 1))
      const cutoffMonthStart = new Date(Date.UTC(cutoffDate.getUTCFullYear(), cutoffDate.getUTCMonth(), 1))

      while (cursor < cutoffMonthStart) {
        months.push(
          `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
        )
        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      }

      // ----- 3. Process each calendar month -----
      for (const month of months) {
        try {
          // Idempotency: skip month if an archive record already exists
          const { data: existing, error: existingErr } = await supabase
            .from('audit_archives')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('archive_month', month)
            .maybeSingle()

          if (existingErr) {
            console.error(
              `[cron/archive-audit-logs] Idempotency check failed for ${tenantId}/${month}:`,
              existingErr.message,
            )
            results.errors++
            continue
          }

          if (existing) continue

          // Compute exact UTC boundaries for the month
          const [yearStr, monStr] = month.split('-')
          const year = Number(yearStr)
          const mon = Number(monStr)
          const monthStart = new Date(Date.UTC(year, mon - 1, 1)).toISOString()
          const monthEnd = new Date(Date.UTC(year, mon, 1)).toISOString()

          // ----- 3a. Paginate all audit_logs rows for this tenant+month -----
          const allLogs: Record<string, unknown>[] = []
          let offset = 0
          let hasMore = true

          while (hasMore) {
            const { data: batch, error: batchErr } = await supabase
              .from('audit_logs')
              .select('*')
              .eq('tenant_id', tenantId)
              .gte('created_at', monthStart)
              .lt('created_at', monthEnd)
              .order('created_at', { ascending: true })
              .range(offset, offset + BATCH_SIZE - 1)

            if (batchErr) {
              console.error(
                `[cron/archive-audit-logs] Batch fetch error for ${tenantId}/${month}:`,
                batchErr.message,
              )
              hasMore = false
              break
            }

            if (!batch?.length) {
              hasMore = false
            } else {
              // ----- 3b. Apply PII redaction to metadata field of each row -----
              for (const row of batch) {
                allLogs.push({
                  ...row,
                  metadata: redactPii((row as Record<string, unknown>).metadata),
                })
              }
              offset += batch.length
              if (batch.length < BATCH_SIZE) hasMore = false
            }
          }

          if (allLogs.length === 0) continue

          // ----- 3c. Serialize and compute SHA-256 checksum -----
          const jsonContent = JSON.stringify(allLogs)
          const checksum = createHash('sha256').update(jsonContent).digest('hex')
          const storagePath = `${tenantId}/${month}.json`
          const fileSizeBytes = Buffer.byteLength(jsonContent, 'utf8')

          // ----- 3d. Upload to Supabase Storage -----
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, jsonContent, {
              contentType: 'application/json',
              upsert: false,
            })

          if (uploadErr) {
            console.error(
              `[cron/archive-audit-logs] Upload error for ${tenantId}/${month}:`,
              uploadErr.message,
            )
            results.errors++
            continue
          }

          // ----- 3e. Verify the upload exists before deleting source rows -----
          const { data: signedData, error: signedErr } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, 60)

          if (signedErr || !signedData?.signedUrl) {
            console.error(
              `[cron/archive-audit-logs] Upload verification failed for ${tenantId}/${month}:`,
              signedErr?.message ?? 'no signed URL returned',
            )
            results.errors++
            continue
          }

          // ----- 3f. Insert archive metadata record -----
          const { error: insertErr } = await supabase.from('audit_archives').insert({
            tenant_id: tenantId,
            archive_month: month,
            date_range_start: monthStart,
            date_range_end: monthEnd,
            record_count: allLogs.length,
            storage_path: storagePath,
            file_size_bytes: fileSizeBytes,
            checksum,
          })

          if (insertErr) {
            console.error(
              `[cron/archive-audit-logs] Archive record insert error for ${tenantId}/${month}:`,
              insertErr.message,
            )
            results.errors++
            continue
          }

          // ----- 3g. Delete archived rows from audit_logs -----
          // Service-role client bypasses the append-only RLS on audit_logs.
          const { error: deleteErr } = await supabase
            .from('audit_logs')
            .delete()
            .eq('tenant_id', tenantId)
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd)

          if (deleteErr) {
            console.error(
              `[cron/archive-audit-logs] Delete error for ${tenantId}/${month}:`,
              deleteErr.message,
            )
            // Archive record + storage object exist; mark error but do not
            // roll back. Next invocation will skip this month (idempotent).
            results.errors++
          } else {
            results.archivesCreated++
            results.rowsArchived += allLogs.length
          }
        } catch (monthErr) {
          console.error(
            `[cron/archive-audit-logs] Unexpected error for ${tenantId}/${month}:`,
            monthErr,
          )
          results.errors++
        }
      }

      results.tenantsProcessed++
    } catch (tenantErr) {
      console.error(
        `[cron/archive-audit-logs] Unexpected error processing tenant ${tenantId}:`,
        tenantErr,
      )
      results.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    ...results,
    timestamp: new Date().toISOString(),
  })
}
