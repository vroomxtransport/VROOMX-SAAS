import webpush from 'web-push'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

/**
 * Server-only: Send a push notification to all of a user's subscribed devices.
 *
 * Uses the Web Push protocol via VAPID keys. Expired subscriptions (HTTP 410)
 * are automatically cleaned up from the database.
 *
 * This function is fire-and-forget — it logs errors but never throws,
 * so it's safe to call without awaiting.
 */

interface PushPayload {
  title: string
  body: string
  link?: string
  tag?: string
}

function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@vroomx.app'

  if (!publicKey || !privateKey) {
    return null
  }

  return { publicKey, privateKey, subject }
}

export async function sendPushNotification(
  userId: string,
  tenantId: string,
  payload: PushPayload
): Promise<void> {
  const vapid = getVapidKeys()
  if (!vapid) {
    // VAPID keys not configured — skip silently in dev
    if (process.env.NODE_ENV === 'development') return
    console.warn('[PUSH] VAPID keys not configured — skipping push notification')
    return
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const supabase = createServiceRoleClient()

  // Fetch all push subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (error) {
    console.error('[PUSH] Failed to fetch subscriptions:', error.message)
    return
  }

  if (!subscriptions || subscriptions.length === 0) return

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    link: payload.link || '/dashboard',
    tag: payload.tag || 'vroomx-notification',
  })

  const expiredIds: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload,
          { TTL: 60 * 60 } // 1 hour TTL
        )
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expired — mark for cleanup
          expiredIds.push(sub.id)
        } else {
          console.error(`[PUSH] Failed to send to ${sub.endpoint.slice(0, 50)}...:`, statusCode)
        }
      }
    })
  )

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)

    if (deleteError) {
      console.error('[PUSH] Failed to clean expired subscriptions:', deleteError.message)
    }
  }
}
