'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchBrokers, fetchBroker, type BrokerFilters } from '@/lib/queries/brokers'
import { useEffect } from 'react'

export function useBrokers(filters: BrokerFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['brokers', filters],
    queryFn: () => fetchBrokers(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('brokers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brokers',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['brokers'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useBroker(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['broker', id],
    queryFn: () => fetchBroker(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
