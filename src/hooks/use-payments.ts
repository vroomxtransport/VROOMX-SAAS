'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchPaymentsByOrder } from '@/lib/queries/payments'
import { useEffect } from 'react'

export function usePaymentsByOrder(orderId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['payments', orderId],
    queryFn: () => fetchPaymentsByOrder(supabase, orderId),
    enabled: !!orderId,
    staleTime: 30_000,
  })

  // Realtime subscription on payments table filtered by order_id
  // Invalidate both payments and order queries on change
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`payments-${orderId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payments', orderId] })
          queryClient.invalidateQueries({ queryKey: ['order', orderId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, orderId])

  return query
}
