'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchLocalRuns, fetchLocalRun, type LocalRunFilters } from '@/lib/queries/local-runs'
import { useEffect } from 'react'

export function useLocalRuns(filters: LocalRunFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['local-runs', filters],
    queryFn: () => fetchLocalRuns(supabase, filters),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('local-runs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'local_runs' },
        () => { queryClient.invalidateQueries({ queryKey: ['local-runs'] }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  return query
}

export function useLocalRun(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['local-run', id],
    queryFn: () => fetchLocalRun(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
