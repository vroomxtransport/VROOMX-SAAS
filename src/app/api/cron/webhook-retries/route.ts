// ============================================================================
// Cron Route: Webhook Retry Processor
// POST /api/cron/webhook-retries
//
// Intended to be triggered by a cron scheduler every 1–5 minutes.
// Secured by CRON_SECRET header (timing-safe via verifyCronSecret).
//
// Flow:
//   1. Query webhook_deliveries with status='pending' and next_retry_at <= now
//   2. For each delivery, join the parent endpoint to get url/secret/enabled
//   3. Skip (mark exhausted) if endpoint has been disabled since delivery was created
//   4. Call deliverWebhook() — it owns the HTTP attempt, status update, and backoff
// ============================================================================

import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { deliverWebhook } from '@/lib/webhooks/webhook-delivery'
import type { WebhookPayload } from '@/lib/webhooks/webhook-types'

// Guard against extremely large backlogs in a single invocation
const MAX_BATCH_SIZE = 100

// Shape of the joined endpoint row returned by the select below
interface EndpointJoin {
  url: string
  secret: string
  enabled: boolean
}

export async function POST(req: Request) {
  // Authenticate the cron caller (timing-safe — matches alerts cron pattern)
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  // ----- 1. Fetch pending deliveries that are due for retry -----
  // Plain join (no !inner) with null-check below — no existing codebase usage of !inner
  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select(`
      id,
      tenant_id,
      endpoint_id,
      event_type,
      payload,
      attempts,
      max_attempts,
      webhook_endpoints (
        url,
        secret,
        enabled
      )
    `)
    .eq('status', 'pending')
    .not('next_retry_at', 'is', null)
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true }) // WH-009: prioritize oldest-due
    .limit(MAX_BATCH_SIZE)

  if (error) {
    console.error('[cron/webhook-retries] Query error:', error.message)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      succeeded: 0,
      failed: 0,
      timestamp: new Date().toISOString(),
    })
  }

  let succeeded = 0
  let failed = 0

  // ----- 2. Process each due delivery -----
  for (const delivery of deliveries) {
    // Supabase PostgREST returns a single object for many-to-one FK joins.
    // The generated client type is an array because it doesn't know the
    // cardinality — cast through unknown to get the correct runtime shape.
    const endpoint = delivery.webhook_endpoints as unknown as EndpointJoin | null

    // Null means the endpoint row was deleted — treat same as disabled
    if (!endpoint?.enabled) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'exhausted',
          response_body: endpoint ? 'Endpoint disabled' : 'Endpoint deleted',
          next_retry_at: null,
        })
        .eq('id', delivery.id)
      failed++
      continue
    }

    const payload = delivery.payload as unknown as WebhookPayload

    try {
      const result = await deliverWebhook(
        delivery.id,
        endpoint.url,
        endpoint.secret,
        payload,
      )
      if (result.success) {
        succeeded++
      } else {
        failed++
      }
    } catch (err: unknown) {
      console.error(
        `[cron/webhook-retries] Delivery ${delivery.id} threw:`,
        err instanceof Error ? err.message : err,
      )
      failed++
    }
  }

  // ----- 3. Return batch summary (matches alerts cron response shape) -----
  return NextResponse.json({
    ok: true,
    processed: deliveries.length,
    succeeded,
    failed,
    timestamp: new Date().toISOString(),
  })
}
