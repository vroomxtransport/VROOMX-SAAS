'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchLatestLocations, fetchSamsaraVehicleLocations } from '@/lib/queries/locations'
import { useEffect } from 'react'

export function useDriverLocations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['driver-locations'],
    queryFn: () => fetchLatestLocations(supabase),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('driver-locations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['driver-locations'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useSamsaraVehicleLocations() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['samsara-vehicle-locations'],
    queryFn: () => fetchSamsaraVehicleLocations(supabase),
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('samsara-vehicles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'samsara_vehicles',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['samsara-vehicle-locations'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
