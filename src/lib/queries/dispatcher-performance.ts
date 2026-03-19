import type { SupabaseClient } from '@supabase/supabase-js'

export interface DispatcherPerformance {
  user_id: string
  name: string
  role: string
  total_orders: number
  completed_orders: number
  total_revenue: number
}

export async function fetchDispatcherPerformance(
  supabase: SupabaseClient
): Promise<DispatcherPerformance[]> {
  const { data: members, error: membersError } = await supabase
    .from('tenant_memberships')
    .select('*')
    .in('role', ['owner', 'admin', 'dispatcher'])

  if (membersError) throw membersError

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('status, revenue, dispatched_by')

  if (ordersError) throw ordersError

  // Group orders by dispatched_by for real per-dispatcher attribution
  const ordersByDispatcher = new Map<string, { total: number; completed: number; revenue: number }>()

  for (const o of orders ?? []) {
    const dispatcherId = (o as Record<string, unknown>).dispatched_by as string | null
    if (!dispatcherId) continue

    const stats = ordersByDispatcher.get(dispatcherId) ?? { total: 0, completed: 0, revenue: 0 }
    stats.total++
    const status = (o as Record<string, unknown>).status as string
    if (status === 'delivered' || status === 'invoiced' || status === 'paid') {
      stats.completed++
    }
    stats.revenue += parseFloat(((o as Record<string, unknown>).revenue as string) || '0')
    ordersByDispatcher.set(dispatcherId, stats)
  }

  return (members ?? []).map((m: Record<string, unknown>) => {
    const userId = m.user_id as string
    const stats = ordersByDispatcher.get(userId)

    return {
      user_id: userId,
      name: (m.full_name as string) || userId.substring(0, 8),
      role: m.role as string,
      total_orders: stats?.total ?? 0,
      completed_orders: stats?.completed ?? 0,
      total_revenue: stats?.revenue ?? 0,
    }
  })
}
