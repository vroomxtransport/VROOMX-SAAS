import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { verifyQuickBooksWebhook } from '@/lib/quickbooks/webhook'
import { getQBClientForTenant, syncPaymentFromQB } from '@/lib/quickbooks/sync'
import { validateQbId } from '@/lib/quickbooks/qbql'
import type { QBWebhookPayload, QBWebhookNotification } from '@/lib/quickbooks/types'

// ---------------------------------------------------------------------------
// POST /api/webhooks/quickbooks
// ---------------------------------------------------------------------------
// Receives real-time event notifications from QuickBooks Online.
// Follows the same pattern as the Stripe webhook:
//   1. Verify signature (HMAC-SHA256)
//   2. Idempotency check per entity event
//   3. Route to appropriate handler
//   4. Return 200 quickly (QB retries on slow responses)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body — MUST be raw text for HMAC verification
  const rawBody = await request.text()

  // 2. Validate signature header
  const signature = request.headers.get('intuit-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing intuit-signature header' },
      { status: 401 }
    )
  }

  // 3. Verify HMAC-SHA256 signature
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER
  if (!verifierToken) {
    console.error('[QB_WEBHOOK] QUICKBOOKS_WEBHOOK_VERIFIER env var not set')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  if (!verifyQuickBooksWebhook(rawBody, signature, verifierToken)) {
    console.error('[QB_WEBHOOK] Signature verification failed')
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  // 4. Parse payload
  let payload: QBWebhookPayload
  try {
    payload = JSON.parse(rawBody) as QBWebhookPayload
  } catch {
    console.error('[QB_WEBHOOK] Failed to parse payload')
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  // 5. Service-role client — webhooks have no user session
  const supabase = createServiceRoleClient()

  // 6. Process each notification
  for (const notification of payload.eventNotifications ?? []) {
    const realmId = notification.realmId

    // Look up which tenant owns this realm.
    //
    // CodeAuditX #4 (two fixes):
    //
    //   (a) Latent column bug — the prior code filtered on `status = 'active'`
    //       but the schema column is `sync_status` (see
    //       src/db/schema.ts::quickbooksIntegrations). PostgREST returned
    //       `42703: column does not exist` on every call, and the webhook
    //       silently dropped every event because the destructure ignored
    //       the error. Verified via information_schema lookup against the
    //       live DB on 2026-04-11 (no `status` column, `sync_status` only).
    //
    //   (b) Capture `id` and `sync_status` so that assertIntegrationActive()
    //       below can cheaply re-verify the integration before each
    //       downstream entity handler, closing the TOCTOU window where a
    //       tenant could disable their integration between this initial
    //       lookup and the handler call (C-2).
    const { data: integration, error: lookupError } = await supabase
      .from('quickbooks_integrations')
      .select('id, tenant_id, sync_status')
      .eq('realm_id', realmId)
      .eq('sync_status', 'active')
      .single()

    if (lookupError || !integration) {
      // PGRST116 = 0 rows matched (no active integration for this realm)
      // — log at info level because it's the normal "unknown realm" case.
      // Anything else is an actual query error worth surfacing.
      if (lookupError && lookupError.code !== 'PGRST116') {
        console.error(
          '[QB_WEBHOOK] Integration lookup failed for realmId:',
          realmId,
          lookupError.message
        )
      } else {
        console.warn('[QB_WEBHOOK] No active integration for realmId:', realmId)
      }
      continue
    }

    const entities = notification.dataChangeEvent?.entities ?? []

    for (const entity of entities) {
      // C-2: re-verify integration is still active before each entity handler.
      // If the tenant disabled/deleted their QB integration between the
      // initial lookup above and this iteration, stop processing their events.
      const stillActive = await assertIntegrationActive(supabase, integration.id)
      if (!stillActive) {
        console.warn(
          '[QB_WEBHOOK] Integration became inactive mid-batch, skipping remaining entities for realmId:',
          realmId
        )
        break
      }

      await processEntity(supabase, integration.tenant_id, realmId, entity)
    }
  }

  // 7. Return 200 quickly — QB expects a fast response
  return NextResponse.json({ received: true })
}

// ---------------------------------------------------------------------------
// Process a single entity change event
// ---------------------------------------------------------------------------

async function processEntity(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tenantId: string,
  realmId: string,
  entity: QBWebhookNotification
): Promise<void> {
  // Build a deterministic event key for idempotency
  const eventKey = `${entity.name}-${entity.id}-${entity.operation}-${entity.lastUpdated}`

  // Idempotency check — skip if we already processed this event
  const { data: existing } = await supabase
    .from('quickbooks_webhook_events')
    .select('id')
    .eq('event_id', eventKey)
    .single()

  if (existing) return

  // Record the event before processing (insert-first prevents duplicates
  // if the handler is slow and QB retries).
  //
  // CodeAuditX #4 (bonus latent bug, same class as the sync_status fix above):
  // the prior insert wrote `event_type: 'Payment.Create'` to a column that
  // doesn't exist in `quickbooks_webhook_events`. The schema has `entity_type`
  // and `operation` as SEPARATE NOT NULL columns (plus `entity_id` and
  // `payload` which are also NOT NULL). Every insert would have failed with
  // either `42703` or `23502` on the first real webhook. Verified against
  // live DB schema on 2026-04-11. Surfaced by the security-auditor agent
  // reviewing the primary C-2 fix.
  const { error: insertError } = await supabase
    .from('quickbooks_webhook_events')
    .insert({
      tenant_id: tenantId,
      event_id: eventKey,
      realm_id: realmId,
      entity_type: entity.name,
      entity_id: entity.id,
      operation: entity.operation,
      payload: entity,
      processed_at: new Date().toISOString(),
    })

  // If insert fails due to unique constraint, another worker already picked
  // it up — skip gracefully
  if (insertError) {
    if (insertError.code === '23505') return // unique_violation
    console.error('[QB_WEBHOOK] Failed to insert event:', insertError.message)
    return
  }

  // Route to the appropriate handler
  try {
    switch (`${entity.name}.${entity.operation}`) {
      case 'Payment.Create':
      case 'Payment.Update': {
        // Fetch the payment from QB to get amount + linked invoice
        const qbClient = await getQBClientForTenant(supabase, tenantId)
        if (!qbClient) break

        // C1 fix: validate entity.id is a numeric string before interpolating
        // into the QBQL query. The webhook signature is verified upstream, but
        // a leaked verifier secret or compromised QB account would otherwise
        // permit arbitrary QBQL injection here.
        const idResult = validateQbId(entity.id)
        if (!idResult.success) {
          console.warn('[QB_WEBHOOK] Invalid Payment entity.id, skipping', {
            id: entity.id,
            realmId,
          })
          break
        }

        const payments = await qbClient.query<{
          Id: string
          TotalAmt: number
          Line: Array<{
            Amount: number
            LinkedTxn: Array<{ TxnId: string; TxnType: string }>
          }>
        }>(`SELECT * FROM Payment WHERE Id = '${idResult.data}'`)

        const payment = payments[0]
        if (!payment) break

        // Extract linked invoice IDs and sync each
        for (const line of payment.Line ?? []) {
          for (const txn of line.LinkedTxn ?? []) {
            if (txn.TxnType === 'Invoice') {
              await syncPaymentFromQB(
                supabase,
                tenantId,
                txn.TxnId,
                line.Amount
              )
            }
          }
        }
        break
      }

      case 'Invoice.Void':
      case 'Invoice.Delete': {
        // N25: when a QB invoice is voided or deleted, revert the VroomX
        // order's payment_status back to 'unpaid' and clear the invoice_date.
        // This prevents financial mismatch where QB shows no invoice but
        // VroomX still shows 'invoiced' or 'paid'.
        const { data: invoiceMap } = await supabase
          .from('quickbooks_entity_map')
          .select('vroomx_id')
          .eq('tenant_id', tenantId)
          .eq('entity_type', 'order_invoice')
          .eq('qb_id', entity.id)
          .maybeSingle()

        if (invoiceMap?.vroomx_id) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'unpaid',
              invoice_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoiceMap.vroomx_id)
            .eq('tenant_id', tenantId)

          // Remove the entity map entry so re-sync creates a fresh invoice
          await supabase
            .from('quickbooks_entity_map')
            .delete()
            .eq('tenant_id', tenantId)
            .eq('entity_type', 'order_invoice')
            .eq('qb_id', entity.id)

          console.info(
            `[QB_WEBHOOK] Invoice ${entity.operation === 'Void' ? 'voided' : 'deleted'}: ` +
            `QB ${entity.id} → order ${invoiceMap.vroomx_id} reverted to unpaid`
          )
        } else {
          console.info(
            `[QB_WEBHOOK] Invoice ${entity.operation}: QB ${entity.id} not mapped to any VroomX order`
          )
        }
        break
      }

      case 'Customer.Update':
      case 'Customer.Merge':
        // TODO: sync customer updates back to VroomX broker records
        break

      default:
        // Unhandled entity/operation — logged for observability but no action
        break
    }
  } catch (error) {
    // Log but don't throw — we already recorded the event and don't want
    // to block processing of remaining entities
    console.error(
      `[QB_WEBHOOK] Handler failed for ${entity.name}.${entity.operation}:`,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

// ---------------------------------------------------------------------------
// CodeAuditX #4 (C-2): re-verify an integration is still active before
// firing an entity handler. Guards against the TOCTOU window where a tenant
// disables or deletes their QB integration between the realm_id → tenant_id
// lookup at the top of POST() and the per-entity loop. Keyed on integration
// `id` rather than `tenant_id` because `id` is the primary key and cheaper
// to look up than a composite filter.
//
// Returns true iff the integration still exists with sync_status='active'.
// Any other state (row missing, paused, disconnected, query error) →
// returns false, caller should skip remaining entities for this realm.
// ---------------------------------------------------------------------------

async function assertIntegrationActive(
  supabase: ReturnType<typeof createServiceRoleClient>,
  integrationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('quickbooks_integrations')
    .select('sync_status')
    .eq('id', integrationId)
    .maybeSingle()

  if (error) {
    console.error(
      '[QB_WEBHOOK] assertIntegrationActive lookup failed:',
      error.message
    )
    return false
  }

  if (!data) return false

  return (data as { sync_status: string }).sync_status === 'active'
}
