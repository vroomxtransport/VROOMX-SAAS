'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { useCurrentTenantId } from '@/hooks/use-current-tenant-id'

export interface UnreadCount {
  channelId: string
  count: number
}

interface UnreadResult {
  total: number
  byChannel: UnreadCount[]
}

// Row shape returned by the get_unread_counts Postgres RPC.
interface UnreadRpcRow {
  channel_id: string
  unread_count: number
}

async function fetchUnreadCounts(userId: string): Promise<UnreadResult> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('get_unread_counts', {
    p_user_id: userId,
  })

  if (error) throw error

  const rows = (data ?? []) as UnreadRpcRow[]
  const byChannel: UnreadCount[] = rows.map((r) => ({
    channelId: r.channel_id,
    count: Number(r.unread_count),
  }))
  const total = byChannel.reduce((sum, r) => sum + r.count, 0)

  return { total, byChannel }
}

export function useChatUnread(userId: string | undefined) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  const tenantId = useCurrentTenantId()

  const query = useQuery({
    queryKey: ['chat-unread', userId],
    queryFn: () => fetchUnreadCounts(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000, // fallback poll every minute
  })

  // Realtime: invalidate the unread count when a new message arrives for
  // this tenant. Scoped to tenant_id so we don't fan-out cross-tenant events.
  useEffect(() => {
    if (!userId || !tenantId) return

    const channel = supabase
      .channel(`chat-unread-listener:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
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
  }, [userId, tenantId, supabase, queryClient])

  return {
    totalUnread: query.data?.total ?? 0,
    byChannel: query.data?.byChannel ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
