'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type PresenceStatus = 'online' | 'busy'

export interface PresenceMember {
  userId: string
  userName: string
  email: string
  status: PresenceStatus
}

interface CurrentUser {
  userId: string
  userName: string
  email: string
}

interface PresenceState {
  userId: string
  userName: string
  email: string
  status: PresenceStatus
}

export function useChatPresence(tenantId: string, currentUser: CurrentUser) {
  const [members, setMembers] = useState<PresenceMember[]>([])
  const [currentStatus, setCurrentStatus] = useState<PresenceStatus>('online')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const statusRef = useRef<PresenceStatus>('online')
  const supabase = createClient()

  // Sync presence state into members array
  const syncPresence = useCallback(() => {
    if (!channelRef.current) return

    const state = channelRef.current.presenceState<PresenceState>()
    const memberMap = new Map<string, PresenceMember>()

    // Each key in state is a presence key, value is array of presences for that key
    for (const presences of Object.values(state)) {
      for (const presence of presences) {
        // Deduplicate by userId — last presence wins (handles multiple tabs)
        memberMap.set(presence.userId, {
          userId: presence.userId,
          userName: presence.userName,
          email: presence.email,
          status: presence.status,
        })
      }
    }

    // Sort: current user first, then alphabetical
    const sorted = Array.from(memberMap.values()).sort((a, b) => {
      if (a.userId === currentUser.userId) return -1
      if (b.userId === currentUser.userId) return 1
      return (a.userName || a.email).localeCompare(b.userName || b.email)
    })

    setMembers(sorted)
  }, [currentUser.userId])

  // Subscribe to presence channel
  useEffect(() => {
    const channel = supabase.channel(`chat-presence:${tenantId}`, {
      config: { presence: { key: currentUser.userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        syncPresence()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.userId,
            userName: currentUser.userName,
            email: currentUser.email,
            status: statusRef.current,
          })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, tenantId, currentUser.userId, currentUser.userName, currentUser.email, syncPresence])

  // Update status (online <-> busy)
  const setStatus = useCallback(async (newStatus: PresenceStatus) => {
    statusRef.current = newStatus
    setCurrentStatus(newStatus)
    if (channelRef.current) {
      await channelRef.current.track({
        userId: currentUser.userId,
        userName: currentUser.userName,
        email: currentUser.email,
        status: newStatus,
      })
    }
  }, [currentUser.userId, currentUser.userName, currentUser.email])

  const onlineCount = members.length

  return { members, onlineCount, setStatus, currentStatus }
}
