import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatChannel, ChatMessage } from '@/types/database'

export async function fetchChannels(supabase: SupabaseClient): Promise<ChatChannel[]> {
  const { data, error } = await supabase
    .from('chat_channels')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChatChannel[]
}

export async function fetchMessages(
  supabase: SupabaseClient,
  channelId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data ?? []) as ChatMessage[]
}
