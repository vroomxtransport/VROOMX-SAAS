'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDrivers, fetchDriver, type DriverFilters } from '@/lib/queries/drivers'
import { useEffect } from 'react'

export function useDrivers(filters: DriverFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['drivers', filters],
    queryFn: () => fetchDrivers(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('drivers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['drivers'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useDriver(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['driver', id],
    queryFn: () => fetchDriver(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
