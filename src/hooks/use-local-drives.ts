'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchLocalDrives, fetchLocalDrive, type LocalDriveFilters } from '@/lib/queries/local-drives'
import { useEffect } from 'react'

export function useLocalDrives(filters: LocalDriveFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['local-drives', filters],
    queryFn: () => fetchLocalDrives(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('local-drives-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'local_drives',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['local-drives'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useLocalDrive(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['local-drive', id],
    queryFn: () => fetchLocalDrive(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}
