'use server'

import { authorize, safeError } from '@/lib/authz'
import { messageSchema, channelSchema } from '@/lib/validations/chat'
import { revalidatePath } from 'next/cache'

export async function sendMessage(channelId: string, data: unknown) {
  const parsed = messageSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('chat.create', { rateLimit: { key: 'sendMessage', limit: 60, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: message, error } = await supabase.from('chat_messages').insert({
    tenant_id: tenantId,
    channel_id: channelId,
    user_id: user.id,
    user_name: user.email?.split('@')[0] || 'Unknown',
    content: parsed.data.content,
  }).select().single()

  if (error) return { error: safeError(error, 'sendMessage') }
  revalidatePath('/team-chat')
  return { success: true, data: message }
}

export async function createChannel(data: unknown) {
  const parsed = channelSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('chat.create', { rateLimit: { key: 'createChannel', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: channel, error } = await supabase.from('chat_channels').insert({
    tenant_id: tenantId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: safeError(error, 'createChannel') }
  revalidatePath('/team-chat')
  return { success: true, data: channel }
}
