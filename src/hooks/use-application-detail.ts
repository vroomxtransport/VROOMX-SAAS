'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchApplicationDetail } from '@/lib/queries/applications'
import { useEffect } from 'react'

/**
 * TanStack Query hook for the full application detail view (admin pipeline).
 *
 * Returns the application + addressHistory + consents + documents + pipeline + steps.
 * Realtime invalidation on step or pipeline changes.
 */
export function useApplicationDetail(id: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['applications', id],
    queryFn: () => fetchApplicationDetail(id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  // Realtime: invalidate on pipeline or step changes
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`application-detail-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_onboarding_steps' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['applications', id] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_onboarding_pipelines' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['applications', id] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_applications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['applications', id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, id])

  return query
}
