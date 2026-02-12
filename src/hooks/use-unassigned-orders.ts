'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'
import type { Order, Broker } from '@/types/database'

export interface UnassignedOrderWithBroker extends Order {
  broker: Pick<Broker, 'id' | 'name'> | null
}

export function useUnassignedOrders(search?: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['unassigned-orders', search],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, broker:brokers(id, name)')
        .is('trip_id', null)
        .in('status', ['new', 'assigned'])
        .order('created_at', { ascending: false })

      if (search) {
        q = q.or(`order_number.ilike.%${search}%,vehicle_vin.ilike.%${search}%,vehicle_make.ilike.%${search}%`)
      }

      const { data, error } = await q

      if (error) throw error

      return (data ?? []) as UnassignedOrderWithBroker[]
    },
    staleTime: 30_000,
  })

  // Realtime: subscribe to orders table changes to keep list fresh
  useEffect(() => {
    const channel = supabase
      .channel('unassigned-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}
