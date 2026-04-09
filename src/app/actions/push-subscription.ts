'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/**
 * Save or update a push subscription for the current user.
 * Called when the browser registers a new PushSubscription.
 */
export async function subscribePush(data: unknown) {
  const parsed = subscribeSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid subscription data' }

  const authResult = await authorize('*', {
    rateLimit: { key: 'pushSubscribe', limit: 10, windowMs: 60_000 },
  })
  if (!authResult.ok) return { error: authResult.error }
  const { supabase, tenantId, user } = authResult.ctx

  // Upsert: if endpoint already exists for this user, update keys
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
        user_agent: null, // User agent set by client if needed
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

  if (error) return { error: safeError(error, 'subscribePush') }
  return { success: true }
}

/**
 * Remove a push subscription for the current user.
 * Called when the user opts out of push notifications.
 */
export async function unsubscribePush(data: unknown) {
  const parsed = unsubscribeSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid endpoint' }

  const authResult = await authorize('*', {
    rateLimit: { key: 'pushUnsubscribe', limit: 10, windowMs: 60_000 },
  })
  if (!authResult.ok) return { error: authResult.error }
  const { supabase, user } = authResult.ctx

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data.endpoint)

  if (error) return { error: safeError(error, 'unsubscribePush') }
  return { success: true }
}
