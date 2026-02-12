'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTripExpenses } from '@/lib/queries/trip-expenses'
import { useEffect } from 'react'

export function useTripExpenses(tripId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trip-expenses', tripId],
    queryFn: () => fetchTripExpenses(supabase, tripId!),
    enabled: !!tripId,
    staleTime: 30_000,
  })

  // Realtime invalidation for trip expenses
  useEffect(() => {
    if (!tripId) return

    const channel = supabase
      .channel(`trip-expenses-${tripId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_expenses',
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip-expenses', tripId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tripId])

  return query
}
