import type { WebhookEventType, WebhookPayload } from './webhook-types'
import { deliverWebhook } from './webhook-delivery'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export async function dispatchWebhookEvent(
  tenantId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceRoleClient()

  // Find all enabled endpoints for this tenant that subscribe to this event
  const { data: endpoints, error } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)

  if (error || !endpoints || endpoints.length === 0) return

  // Filter to endpoints subscribed to this event type
  const matchingEndpoints = endpoints.filter((ep: { events: unknown }) => {
    const events = ep.events as string[]
    return Array.isArray(events) && events.includes(eventType)
  })

  if (matchingEndpoints.length === 0) return

  // For each matching endpoint, create a delivery record and attempt delivery
  for (const endpoint of matchingEndpoints) {
    // Generate ID client-side so the full payload can be stored in one insert
    const deliveryId = crypto.randomUUID()
    const now = new Date().toISOString()

    const payload: WebhookPayload = {
      id: deliveryId,
      event: eventType,
      tenant_id: tenantId,
      created_at: now,
      data,
    }

    const { error: insertError } = await supabase
      .from('webhook_deliveries')
      .insert({
        id: deliveryId,
        tenant_id: tenantId,
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload, // Full WebhookPayload stored — cron retries use this directly
        status: 'pending',
        attempts: 0,
        max_attempts: 5,
      })

    if (insertError) continue

    // Fire-and-forget first delivery attempt
    deliverWebhook(deliveryId, endpoint.url, endpoint.secret, payload)
      .catch((err: unknown) => console.error('[webhook] delivery error:', err))
  }
}
