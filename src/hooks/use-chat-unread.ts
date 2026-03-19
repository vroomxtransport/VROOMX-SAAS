'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

export interface UnreadCount {
  channelId: string
  count: number
}

interface UnreadResult {
  total: number
  byChannel: UnreadCount[]
}

async function fetchUnreadCounts(userId: string): Promise<UnreadResult> {
  const supabase = createClient()

  // Fetch both reads and channels in parallel
  const [readsResult, channelsResult] = await Promise.all([
    supabase
      .from('chat_channel_reads')
      .select('channel_id, last_read_at')
      .eq('user_id', userId),
    supabase
      .from('chat_channels')
      .select('id'),
  ])

  const channels = channelsResult.data
  if (!channels || channels.length === 0) return { total: 0, byChannel: [] }

  const readMap = new Map<string, string>()
  readsResult.data?.forEach((r) => readMap.set(r.channel_id, r.last_read_at))

  let total = 0
  const byChannel: UnreadCount[] = []

  // Count unread messages per channel (N+1 is acceptable for typical team sizes)
  await Promise.all(
    channels.map(async (channel) => {
      const lastRead = readMap.get(channel.id)

      let query = supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', channel.id)
        .neq('user_id', userId) // never count own messages as unread

      if (lastRead) {
        query = query.gt('created_at', lastRead)
      }

      const { count } = await query
      const unread = count ?? 0
      if (unread > 0) {
        total += unread
        byChannel.push({ channelId: channel.id, count: unread })
      }
    })
  )

  return { total, byChannel }
}

export function useChatUnread(userId: string | undefined) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['chat-unread', userId],
    queryFn: () => fetchUnreadCounts(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000, // fallback poll every minute
  })

  // Real-time: invalidate the unread count when any new message arrives
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('chat-unread-listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          // Only invalidate if the message was sent by someone else
          const msg = payload.new as { user_id?: string }
          if (msg.user_id !== userId) {
            queryClient.invalidateQueries({ queryKey: ['chat-unread', userId] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, queryClient])

  return {
    totalUnread: query.data?.total ?? 0,
    byChannel: query.data?.byChannel ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
