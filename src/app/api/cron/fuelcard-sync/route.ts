// ============================================================================
// Cron Route: Multi Service Fuel Card Sync
// POST /api/cron/fuelcard-sync
//
// Intended to be triggered by a cron scheduler (e.g. Vercel Cron, GitHub Actions)
// on a daily or per-shift schedule. Secured by CRON_SECRET header.
//
// Flow per tenant:
//   1. Verify CRON_SECRET header (timing-safe HMAC)
//   2. Fetch all fuelcard_integrations where sync_status != 'disconnected'
//   3. For each tenant, call syncFuelTransactions() with a 7-day UTC lookback
//   4. Aggregate synced / matched / flagged / skipped / error counts
//   5. Return structured JSON result — never throws
//
// Concurrency note: this route has no explicit concurrency guard. If the
// scheduler fires twice in rapid succession, two parallel runs will execute.
// The existing dedup in syncFuelTransactions (tenant_id, provider,
// external_transaction_id unique constraint on fuelcard_transactions) makes
// this correct — the worst case is wasted HTTP calls against the MSFuelCard
// API and duplicated effort, never duplicated rows. A future iteration may
// add a row-based lock table if the MSFuelCard rate limit becomes a concern.
// ============================================================================

import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { syncFuelTransactions } from '@/lib/fuelcard/sync'

// Max tenants processed in a single invocation (guard against very large deploys)
const MAX_TENANTS = 500

export async function POST(req: Request) {
  // Authenticate the cron caller (timing-safe)
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // ----- Build 7-day lookback window (UTC) -----
  // Compute the window entirely in UTC so the day boundary is deterministic
  // regardless of where the cron host lives. Mixing local-time .setDate()
  // with .toISOString() can produce a ± 1 day shift around DST or midnight.
  const nowUtc = new Date()
  const todayUtc = new Date(Date.UTC(
    nowUtc.getUTCFullYear(),
    nowUtc.getUTCMonth(),
    nowUtc.getUTCDate(),
  ))
  const sevenDaysAgoUtc = new Date(todayUtc)
  sevenDaysAgoUtc.setUTCDate(todayUtc.getUTCDate() - 7)

  const endDate = todayUtc.toISOString().split('T')[0]
  const startDate = sevenDaysAgoUtc.toISOString().split('T')[0]

  // ----- Fetch all tenants with an active fuel card integration -----
  const { data: integrationRows, error: fetchErr } = await supabase
    .from('fuelcard_integrations')
    .select('tenant_id')
    .neq('sync_status', 'disconnected')
    .limit(MAX_TENANTS)

  if (fetchErr) {
    console.error('[cron/fuelcard-sync] Failed to fetch integrations:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to load fuel card integrations' }, { status: 500 })
  }

  const tenantIds = [...new Set((integrationRows ?? []).map((r) => r.tenant_id as string))]

  const results = {
    tenantsProcessed: 0,
    transactionsSynced: 0,
    transactionsMatched: 0,
    transactionsFlagged: 0,
    transactionsSkipped: 0,
    errors: 0,
  }

  // ----- Process each tenant independently — never abort on one failure -----
  for (const tenantId of tenantIds) {
    try {
      const syncResult = await syncFuelTransactions(supabase, tenantId, startDate, endDate)

      results.transactionsSynced += syncResult.synced
      results.transactionsMatched += syncResult.matched
      results.transactionsFlagged += syncResult.flagged
      results.transactionsSkipped += syncResult.skipped
      results.errors += syncResult.errors.length

      if (syncResult.errors.length > 0) {
        console.error(
          `[cron/fuelcard-sync] Tenant ${tenantId} completed with ${syncResult.errors.length} transaction error(s)`,
        )
      }

      results.tenantsProcessed++
    } catch (tenantErr) {
      // Log only the message — never the full error object, which may
      // serialize stack traces containing internal paths or secrets.
      const message = tenantErr instanceof Error ? tenantErr.message : 'Unknown error'
      console.error(
        `[cron/fuelcard-sync] Error processing tenant ${tenantId}: ${message}`,
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
