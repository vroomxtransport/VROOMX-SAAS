'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchOrders, fetchOrder, type OrderFilters } from '@/lib/queries/orders'
import { useEffect } from 'react'

export function useOrders(filters: OrderFilters = {}) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(supabase, filters),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  return query
}

export function useOrder(id: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(supabase, id!),
    enabled: !!id,
    staleTime: 30_000,
  })

  // Realtime invalidation for individual order
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`order-${id}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order', id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, id])

  return query
}
