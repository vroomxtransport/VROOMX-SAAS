'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchChannels, fetchMessages } from '@/lib/queries/chat'
import { useEffect } from 'react'
import type { ChatMessage } from '@/types/database'

export function useChannels() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['chat-channels'],
    queryFn: () => fetchChannels(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('chat-channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_channels',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-channels'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useMessages(channelId: string | null) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['chat-messages', channelId],
    queryFn: () => fetchMessages(supabase, channelId!),
    enabled: !!channelId,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (!channelId) return

    const channel = supabase
      .channel('messages-' + channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: 'channel_id=eq.' + channelId,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          queryClient.setQueryData<ChatMessage[]>(
            ['chat-messages', channelId],
            (old) => {
              if (!old) return [newMessage]
              if (old.some((m) => m.id === newMessage.id)) return old
              return [...old, newMessage]
            }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, channelId])

  return query
}
