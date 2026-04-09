'use server'

import { authorize, safeError } from '@/lib/authz'
import {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  deleteWebhookEndpointSchema,
  toggleWebhookEndpointSchema,
  rotateWebhookSecretSchema,
  retryWebhookDeliverySchema,
} from '@/lib/validations/webhook'
import { generateWebhookSecret } from '@/lib/webhooks/webhook-signer'
import { validateWebhookUrl } from '@/lib/webhooks/url-validator'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// createWebhookEndpoint
// ---------------------------------------------------------------------------

export async function createWebhookEndpoint(data: unknown) {
  const parsed = createWebhookEndpointSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('webhooks.create', {
    rateLimit: { key: 'createWebhookEndpoint', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Validate URL (SSRF protection)
  const urlCheck = validateWebhookUrl(parsed.data.url)
  if (!urlCheck.valid) return { error: urlCheck.error! }

  const secret = generateWebhookSecret()

  // WH-003: check suspension (authorize does this by default, but be explicit)
  const { isAccountSuspended } = await import('@/lib/tier')
  const suspendCheck = await isAccountSuspended(supabase, tenantId)
  if (suspendCheck.suspended) return { error: 'Account is suspended' }

  const { data: endpoint, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      tenant_id: tenantId,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      description: parsed.data.description || null,
    })
    // WH-005: scoped select — exclude secret and tenant_id from response
    .select('id, url, events, description, enabled, created_at, updated_at')
    .single()

  if (error) return { error: safeError(error, 'createWebhookEndpoint') }

  revalidatePath('/settings/webhooks')
  // Return WITH the generated secret — this is the only time it's exposed
  return { success: true, data: { ...endpoint, secret } }
}

// ---------------------------------------------------------------------------
// updateWebhookEndpoint
// ---------------------------------------------------------------------------

export async function updateWebhookEndpoint(data: unknown) {
  const parsed = updateWebhookEndpointSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('webhooks.update', {
    rateLimit: { key: 'updateWebhookEndpoint', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Validate URL (SSRF protection)
  const urlCheck = validateWebhookUrl(v.url)
  if (!urlCheck.valid) return { error: urlCheck.error! }

  const { error } = await supabase
    .from('webhook_endpoints')
    .update({
      url: v.url,
      events: v.events,
      description: v.description || null,
      enabled: v.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', v.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'updateWebhookEndpoint') }

  revalidatePath('/settings/webhooks')
  return { success: true }
}

// ---------------------------------------------------------------------------
// deleteWebhookEndpoint
// ---------------------------------------------------------------------------

export async function deleteWebhookEndpoint(data: unknown) {
  const parsed = deleteWebhookEndpointSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid webhook endpoint ID' }

  const auth = await authorize('webhooks.delete', {
    rateLimit: { key: 'deleteWebhookEndpoint', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteWebhookEndpoint') }

  revalidatePath('/settings/webhooks')
  return { success: true }
}

// ---------------------------------------------------------------------------
// toggleWebhookEndpoint
// ---------------------------------------------------------------------------

export async function toggleWebhookEndpoint(data: unknown) {
  const parsed = toggleWebhookEndpointSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid input' }

  const auth = await authorize('webhooks.update', {
    rateLimit: { key: 'toggleWebhookEndpoint', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('webhook_endpoints')
    .update({
      enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'toggleWebhookEndpoint') }

  revalidatePath('/settings/webhooks')
  return { success: true }
}

// ---------------------------------------------------------------------------
// rotateWebhookSecret
// ---------------------------------------------------------------------------

export async function rotateWebhookSecret(data: unknown) {
  const parsed = rotateWebhookSecretSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid webhook endpoint ID' }

  const auth = await authorize('webhooks.update', {
    rateLimit: { key: 'rotateWebhookSecret', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const newSecret = generateWebhookSecret()

  const { error } = await supabase
    .from('webhook_endpoints')
    .update({
      secret: newSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'rotateWebhookSecret') }

  revalidatePath('/settings/webhooks')
  // Return new secret — shown once, caller must save it
  return { success: true, data: { secret: newSecret } }
}

// ---------------------------------------------------------------------------
// retryWebhookDelivery
// ---------------------------------------------------------------------------

export async function retryWebhookDelivery(data: unknown) {
  const parsed = retryWebhookDeliverySchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid delivery ID' }

  const auth = await authorize('webhooks.update', {
    rateLimit: { key: 'retryWebhookDelivery', limit: 20, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Verify the delivery belongs to this tenant and is retryable
  const { data: delivery, error: fetchErr } = await supabase
    .from('webhook_deliveries')
    .select('id, tenant_id, status')
    .eq('id', parsed.data.deliveryId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchErr || !delivery) return { error: 'Webhook delivery not found' }

  // WH-004: only allow retry of failed or exhausted deliveries
  if (delivery.status !== 'failed' && delivery.status !== 'exhausted') {
    return { error: 'Only failed or exhausted deliveries can be retried' }
  }

  // Reset to pending with fresh attempts so the delivery engine makes a real attempt.
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({
      status: 'pending',
      next_retry_at: new Date().toISOString(),
      attempts: 0, // Reset so delivery engine doesn't immediately re-exhaust
    })
    .eq('id', parsed.data.deliveryId)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'retryWebhookDelivery') }

  revalidatePath('/settings/webhooks')
  return { success: true }
}
