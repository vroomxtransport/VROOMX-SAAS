'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { isInternalUrl } from '@/lib/url-safety'
import { revalidatePath } from 'next/cache'

const markReadSchema = z.object({
  id: z.string().uuid(),
})

export async function markNotificationRead(data: unknown) {
  const parsed = markReadSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid notification ID' }

  const auth = await authorize('*', { rateLimit: { key: 'markNotifRead', limit: 60, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const { error } = await supabase
    .from('web_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return { error: safeError(error, 'markNotificationRead') }
  return { success: true }
}

export async function markAllNotificationsRead() {
  const auth = await authorize('*', { rateLimit: { key: 'markAllNotifRead', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, user } = auth.ctx

  const { error } = await supabase
    .from('web_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (error) return { error: safeError(error, 'markAllNotificationsRead') }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function createWebNotification(input: {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}) {
  const auth = await authorize('*', { rateLimit: { key: 'createNotif', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // H3 fix (write-side defense): reject any notification.link that isn't
  // a safe internal path. Combined with the read-side check in
  // notification-dropdown.tsx, this gives defense in depth: poisoned data
  // never enters the table, AND any data that somehow bypassed it is
  // refused at click time.
  if (input.link != null && !isInternalUrl(input.link)) {
    return { error: 'Notification link must be an internal path' }
  }

  const { error } = await supabase.from('web_notifications').insert({
    tenant_id: tenantId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
  })

  if (error) return { error: safeError(error, 'createWebNotification') }
  return { success: true }
}
