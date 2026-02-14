'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDispatchers } from '@/lib/queries/dispatchers'
import { useEffect } from 'react'

export function useDispatchers() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['dispatchers'],
    queryFn: () => fetchDispatchers(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('dispatchers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_memberships',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dispatchers'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
