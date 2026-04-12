'use server'

import { authorize, safeError } from '@/lib/authz'
import { messageSchema, channelSchema } from '@/lib/validations/chat'
import { createWebNotification } from '@/app/actions/notifications'
import { revalidatePath } from 'next/cache'
import { captureAsyncError } from '@/lib/async-safe'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function sendMessage(channelId: string, data: unknown) {
  if (!UUID_RE.test(channelId)) return { error: 'Invalid channel ID' }

  const parsed = messageSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('chat.create', { rateLimit: { key: 'sendMessage', limit: 60, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Validate storage paths belong to this tenant + channel (prevent path traversal)
  const attachments = parsed.data.attachments
  if (attachments && attachments.length > 0) {
    const requiredPrefix = `${tenantId}/${channelId}/`
    for (const att of attachments) {
      if (!att.storagePath.startsWith(requiredPrefix)) {
        return { error: 'Invalid attachment path' }
      }
    }
  }

  // Resolve mentions: drop any client-claimed user_id that doesn't belong to this tenant.
  // Never trust the client — server is the source of truth for who was actually mentioned.
  let verifiedMentions: { userId: string; displayName: string }[] = []
  if (parsed.data.mentions && parsed.data.mentions.length > 0) {
    const claimedIds = parsed.data.mentions.map((m) => m.userId)
    const { data: validMembers } = await supabase
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .in('user_id', claimedIds)

    const validIds = new Set((validMembers ?? []).map((m: { user_id: string }) => m.user_id))
    verifiedMentions = parsed.data.mentions.filter((m) => validIds.has(m.userId))
  }

  const senderName = user.email?.split('@')[0] || 'Unknown'

  const { data: message, error } = await supabase.from('chat_messages').insert({
    tenant_id: tenantId,
    channel_id: channelId,
    user_id: user.id,
    user_name: senderName,
    content: parsed.data.content?.trim() || null,
    attachments: attachments && attachments.length > 0 ? attachments : null,
    mentions: verifiedMentions.length > 0 ? verifiedMentions : null,
  }).select().single()

  if (error) return { error: safeError(error, 'sendMessage') }

  // Fire-and-forget: notify other team members of the new message.
  // Mentioned users get a louder `chat_mention` notification; everyone else gets `chat_message`.
  // No double-notify — each member receives exactly one notification.
  void (async () => {
    try {
      // Fetch channel name for the notification title
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('name')
        .eq('id', channelId)
        .eq('tenant_id', tenantId)
        .single()

      const channelName = channel?.name ?? 'chat'

      // Fetch all tenant members except the sender
      const { data: members } = await supabase
        .from('tenant_memberships')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .neq('user_id', user.id)

      const mentionedIds = new Set(verifiedMentions.map((m) => m.userId))
      const bodyPreview = parsed.data.content?.slice(0, 100) || 'Sent an attachment'

      if (members) {
        for (const member of members) {
          if (mentionedIds.has(member.user_id)) {
            createWebNotification({
              userId: member.user_id,
              type: 'chat_mention',
              title: `${senderName} mentioned you in #${channelName}`,
              body: bodyPreview,
              link: '/team-chat',
            }).catch(captureAsyncError('chat action'))
          } else {
            createWebNotification({
              userId: member.user_id,
              type: 'chat_message',
              title: `New message in #${channelName}`,
              body: bodyPreview,
              link: '/team-chat',
            }).catch(captureAsyncError('chat action'))
          }
        }
      }
    } catch {
      // Notifications are best-effort — never let them break message delivery
    }
  })()

  revalidatePath('/team-chat')
  return { success: true, data: message }
}

export async function updateChannel(channelId: string, data: unknown) {
  if (!UUID_RE.test(channelId)) return { error: 'Invalid channel ID' }

  const parsed = channelSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const auth = await authorize('chat.update', { rateLimit: { key: 'updateChannel', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { data: channel, error } = await supabase
    .from('chat_channels')
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq('id', channelId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return { error: safeError(error, 'updateChannel') }
  revalidatePath('/team-chat')
  return { success: true, data: channel }
}

export async function deleteChannel(channelId: string) {
  if (!UUID_RE.test(channelId)) return { error: 'Invalid channel ID' }

  const auth = await authorize('chat.delete', { rateLimit: { key: 'deleteChannel', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('chat_channels')
    .delete()
    .eq('id', channelId)
    .eq('tenant_id', tenantId)

  if (error) return { error: safeError(error, 'deleteChannel') }
  revalidatePath('/team-chat')
  return { success: true }
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
