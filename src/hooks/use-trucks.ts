'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTrucks, fetchTruck, type TruckFilters } from '@/lib/queries/trucks'
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
