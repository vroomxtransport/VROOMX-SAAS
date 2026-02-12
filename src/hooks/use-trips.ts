'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTrips, fetchTrip, type TripFilters } from '@/lib/queries/trips'
import { useEffect } from 'react'

export function useTrips(filters: TripFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trips', filters],
    queryFn: () => fetchTrips(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation: listen to trips table AND orders table
  // (order assignment changes affect trip display: order_count, route summary, etc.)
  useEffect(() => {
    const channel = supabase
      .channel('trips-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trips'] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trips'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useTrip(id: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trip', id],
    queryFn: () => fetchTrip(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  // Realtime invalidation for individual trip:
  // - trips table filtered by id
  // - orders table filtered by trip_id (order changes affect trip financials/count)
  // - trip_expenses table filtered by trip_id (expense changes affect trip financials)
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`trip-${id}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip', id] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `trip_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip', id] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_expenses',
          filter: `trip_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip', id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, id])

  return query
}
