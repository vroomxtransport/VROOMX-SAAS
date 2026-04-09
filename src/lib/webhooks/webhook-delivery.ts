import { signPayload } from './webhook-signer'
import type { WebhookPayload } from './webhook-types'
import { RETRY_BACKOFF_SECONDS } from './webhook-types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { validateResolvedUrl } from './url-validator'

const DELIVERY_TIMEOUT_MS = 10_000
const MAX_RESPONSE_BODY_LENGTH = 4096

export async function deliverWebhook(
  deliveryId: string,
  endpointUrl: string,
  secret: string,
  payload: WebhookPayload,
): Promise<{ success: boolean }> {
  const supabase = createServiceRoleClient()

  // WH-001/WH-002: DNS-resolution-based SSRF check before every delivery
  const urlCheck = await validateResolvedUrl(endpointUrl)
  if (!urlCheck.valid) {
    await supabase.from('webhook_deliveries').update({
      status: 'exhausted',
      response_body: `SSRF blocked: ${urlCheck.error}`,
      attempts: 99,
      next_retry_at: null,
    }).eq('id', deliveryId)
    return { success: false }
  }
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signedContent = `${timestamp}.${body}`
  const signature = signPayload(signedContent, secret)

  let responseCode: number | null = null
  let responseBody: string | null = null
  let success = false

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': payload.id,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Signature': `v1=${signature}`,
        'User-Agent': 'VroomX-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
      redirect: 'manual', // WH-001: prevent SSRF via redirect to internal IPs
    })

    clearTimeout(timeout)
    responseCode = response.status
    responseBody = (await response.text()).slice(0, MAX_RESPONSE_BODY_LENGTH)
    success = response.status >= 200 && response.status < 300
  } catch (err: unknown) {
    responseBody = err instanceof Error ? err.message.slice(0, MAX_RESPONSE_BODY_LENGTH) : 'Unknown error'
  }

  // Fetch current delivery to get attempt count
  const { data: delivery } = await supabase
    .from('webhook_deliveries')
    .select('attempts, max_attempts')
    .eq('id', deliveryId)
    .single()

  const currentAttempt = (delivery?.attempts ?? 0) + 1
  const maxAttempts = delivery?.max_attempts ?? 5

  if (success) {
    await supabase.from('webhook_deliveries').update({
      status: 'success',
      response_code: responseCode,
      response_body: responseBody,
      attempts: currentAttempt,
      next_retry_at: null,
    }).eq('id', deliveryId)
  } else if (currentAttempt >= maxAttempts) {
    await supabase.from('webhook_deliveries').update({
      status: 'exhausted',
      response_code: responseCode,
      response_body: responseBody,
      attempts: currentAttempt,
      next_retry_at: null,
    }).eq('id', deliveryId)
  } else {
    const backoffIndex = Math.min(currentAttempt - 1, RETRY_BACKOFF_SECONDS.length - 1)
    const backoffSeconds = RETRY_BACKOFF_SECONDS[backoffIndex]
    const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString()
    await supabase.from('webhook_deliveries').update({
      status: 'pending',
      response_code: responseCode,
      response_body: responseBody,
      attempts: currentAttempt,
      next_retry_at: nextRetry,
    }).eq('id', deliveryId)
  }

  return { success }
}
