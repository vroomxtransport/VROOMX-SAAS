'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchUnreadNotifications } from '@/lib/queries/notifications'
import { useEffect } from 'react'
import type { WebNotification } from '@/types/database'

export function useUnreadNotifications(userId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications-unread', userId],
    queryFn: () => fetchUnreadNotifications(supabase, userId!),
    enabled: !!userId,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('web-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'web_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as WebNotification
          queryClient.setQueryData<WebNotification[]>(
            ['notifications-unread', userId],
            (old) => {
              if (!old) return [newNotif]
              if (old.some((n) => n.id === newNotif.id)) return old
              return [newNotif, ...old]
            }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, userId])

  return {
    notifications: query.data ?? [],
    count: query.data?.length ?? 0,
    isLoading: query.isPending,
    refetch: query.refetch,
  }
}
