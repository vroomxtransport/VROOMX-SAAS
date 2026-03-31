'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTerminals, fetchTerminal } from '@/lib/queries/terminals'
import { useEffect } from 'react'

export function useTerminals(opts: { activeOnly?: boolean } = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['terminals', opts],
    queryFn: () => fetchTerminals(supabase, opts),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('terminals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'terminals' },
        () => { queryClient.invalidateQueries({ queryKey: ['terminals'] }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, queryClient])

  return query
}

export function useTerminal(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['terminal', id],
    queryFn: () => fetchTerminal(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
