'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTrailers, fetchTrailer, type TrailerFilters } from '@/lib/queries/trailers'
import { useEffect } from 'react'

export function useTrailers(filters: TrailerFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['trailers', filters],
    queryFn: () => fetchTrailers(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('trailers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trailers',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trailers'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useTrailer(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['trailer', id],
    queryFn: () => fetchTrailer(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
