'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchMaintenanceRecords,
  fetchMaintenanceRecord,
  fetchMaintenanceCounts,
  type MaintenanceFilters,
} from '@/lib/queries/maintenance'
import { useEffect } from 'react'

export function useMaintenanceRecords(filters: MaintenanceFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['maintenance', filters],
    queryFn: () => fetchMaintenanceRecords(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('maintenance-records-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_records',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['maintenance'] })
          queryClient.invalidateQueries({ queryKey: ['maintenance-counts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useMaintenanceRecord(id: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['maintenance', id],
    queryFn: () => fetchMaintenanceRecord(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useMaintenanceCounts() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['maintenance-counts'],
    queryFn: () => fetchMaintenanceCounts(supabase),
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('maintenance-counts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_records',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['maintenance-counts'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
