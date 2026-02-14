'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchFuelEntries, fetchFuelStats, type FuelFilters } from '@/lib/queries/fuel'
import { useEffect } from 'react'

export function useFuelEntries(filters: FuelFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['fuel_entries', filters],
    queryFn: () => fetchFuelEntries(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('fuel-entries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fuel_entries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fuel_entries'] })
          queryClient.invalidateQueries({ queryKey: ['fuel_stats'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useFuelStats() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['fuel_stats'],
    queryFn: () => fetchFuelStats(supabase),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('fuel-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fuel_entries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fuel_stats'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
