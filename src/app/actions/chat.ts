'use server'

import { createClient } from '@/lib/supabase/server'
import { messageSchema, channelSchema } from '@/lib/validations/chat'
import { revalidatePath } from 'next/cache'

export async function sendMessage(channelId: string, data: unknown) {
  const parsed = messageSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  const { error } = await supabase.from('chat_messages').insert({
    tenant_id: tenantId,
    channel_id: channelId,
    user_id: user.id,
    user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
    content: parsed.data.content,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function createChannel(data: unknown) {
  const parsed = channelSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  const { data: channel, error } = await supabase.from('chat_channels').insert({
    tenant_id: tenantId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    created_by: user.id,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/team-chat')
  return { data: channel }
}
