'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchWorkOrderDetail } from '@/lib/queries/work-orders'

/**
 * Single work-order detail (with shop, truck/trailer, items, notes).
 * Subscribes to realtime changes on the WO row, its items, and its notes
 * so the detail page stays in sync without manual refetches.
 */
export function useWorkOrder(id: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['work-order', id],
    queryFn: () => (id ? fetchWorkOrderDetail(supabase, id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 15_000,
  })

  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`work-order-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_records', filter: `id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_order_items', filter: `work_order_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_order_notes', filter: `work_order_id=eq.${id}` },
        () => queryClient.invalidateQueries({ queryKey: ['work-order', id] }),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, id])

  return query
}
