'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { revalidatePath } from 'next/cache'

const markReadSchema = z.object({
  id: z.string().uuid(),
})

export async function markNotificationRead(data: unknown) {
  const parsed = markReadSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid notification ID' }

  const auth = await authorize('*')
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
  const auth = await authorize('*')
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
  tenantId: string
  userId: string
  type: string
  title: string
  body: string
  link?: string
}) {
  const auth = await authorize('*')
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth.ctx

  const { error } = await supabase.from('web_notifications').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
  })

  if (error) return { error: safeError(error, 'createWebNotification') }
  return { success: true }
}
