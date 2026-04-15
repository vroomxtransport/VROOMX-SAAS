'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchWorkOrderDetail } from '@/lib/queries/work-orders'

/**
 * Single work-order detail (with shop, truck/trailer, items, notes).
 *
 * Refresh strategy: this module relies on Next.js `router.refresh()` after
 * every server-action mutation rather than Supabase realtime. The
 * maintenance_records / work_order_items / work_order_notes tables aren't
 * in the supabase_realtime publication, and the rest of the codebase uses
 * the router-refresh pattern — keeping consistency keeps things simple.
 */
export function useWorkOrder(id: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['work-order', id],
    queryFn: () => (id ? fetchWorkOrderDetail(supabase, id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 15_000,
  })
}
