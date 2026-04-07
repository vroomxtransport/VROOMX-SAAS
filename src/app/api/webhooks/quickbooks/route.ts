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

    // Look up which tenant owns this realm
    const { data: integration } = await supabase
      .from('quickbooks_integrations')
      .select('tenant_id')
      .eq('realm_id', realmId)
      .eq('status', 'active')
      .single()

    if (!integration) {
      console.warn('[QB_WEBHOOK] No active integration for realmId:', realmId)
      continue
    }

    const entities = notification.dataChangeEvent?.entities ?? []

    for (const entity of entities) {
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
  // if the handler is slow and QB retries)
  const { error: insertError } = await supabase
    .from('quickbooks_webhook_events')
    .insert({
      tenant_id: tenantId,
      event_id: eventKey,
      event_type: `${entity.name}.${entity.operation}`,
      realm_id: realmId,
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
        // TODO: implement voidInvoiceInVroomX — mark matching VroomX
        // invoice as voided and update order payment status
        console.info(
          `[QB_WEBHOOK] Invoice voided: ${entity.id} for tenant ${tenantId}`
        )
        break

      case 'Invoice.Delete':
        // TODO: handle deleted invoice — unlink from VroomX order
        console.info(
          `[QB_WEBHOOK] Invoice deleted: ${entity.id} for tenant ${tenantId}`
        )
        break

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
