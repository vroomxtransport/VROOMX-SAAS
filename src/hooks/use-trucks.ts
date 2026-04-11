'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchTrucks,
  fetchTruck,
  getLatestOdometer,
  type TruckFilters,
} from '@/lib/queries/trucks'
import { useEffect } from 'react'

export function useTrucks(filters: TruckFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trucks', filters],
    queryFn: () => fetchTrucks(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('trucks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trucks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trucks'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useTruck(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['truck', id],
    queryFn: () => fetchTruck(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

/**
 * Resolves the most recent odometer reading across Samsara, fuel entries,
 * and completed maintenance records. Cached 60s — stale-while-revalidate
 * is fine since odometer doesn't need real-time accuracy in the UI.
 */
export function useLatestOdometer(truckId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['truck-odometer', truckId],
    queryFn: () => getLatestOdometer(supabase, truckId!),
    enabled: !!truckId,
    staleTime: 60_000,
  })
}
