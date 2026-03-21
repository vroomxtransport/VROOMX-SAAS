'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchSafetyEvents,
  fetchSafetyEvent,
  fetchSafetyEventStats,
  type SafetyEventFilters,
} from '@/lib/queries/safety-events'
import { useEffect } from 'react'

export function useSafetyEvents(filters: SafetyEventFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['safety-events', filters],
    queryFn: () => fetchSafetyEvents(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('safety-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'safety_events',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['safety-events'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useSafetyEvent(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['safety-event', id],
    queryFn: () => fetchSafetyEvent(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useSafetyEventStats() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['safety-event-stats'],
    queryFn: () => fetchSafetyEventStats(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('safety-event-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'safety_events',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['safety-event-stats'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
