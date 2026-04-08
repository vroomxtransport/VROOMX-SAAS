'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchApplications, type ApplicationFilters } from '@/lib/queries/applications'
import { useEffect } from 'react'

/**
 * TanStack Query hook for the admin applications inbox.
 *
 * Mirrors the use-drivers pattern: staleTime 30s, Supabase Realtime invalidation.
 */
export function useApplications(filters: ApplicationFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['applications', filters],
    queryFn: () => fetchApplications(filters),
    staleTime: 30_000,
  })

  // Realtime invalidation on any change to driver_applications
  useEffect(() => {
    const channel = supabase
      .channel('applications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_applications',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['applications'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
