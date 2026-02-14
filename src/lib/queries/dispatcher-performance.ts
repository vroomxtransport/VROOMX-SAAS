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
    .select('status, revenue')

  if (ordersError) throw ordersError

  const totalOrders = orders?.length ?? 0
  const completedOrders = orders?.filter(
    (o: Record<string, unknown>) =>
      o.status === 'delivered' || o.status === 'invoiced' || o.status === 'paid'
  ).length ?? 0
  const totalRevenue = orders?.reduce(
    (sum: number, o: Record<string, unknown>) => sum + parseFloat((o.revenue as string) || '0'),
    0
  ) ?? 0

  const memberCount = (members ?? []).length || 1

  return (members ?? []).map((m: Record<string, unknown>) => ({
    user_id: m.user_id as string,
    name: (m.full_name as string) || (m.user_id as string).substring(0, 8),
    role: m.role as string,
    total_orders: Math.round(totalOrders / memberCount),
    completed_orders: Math.round(completedOrders / memberCount),
    total_revenue: Math.round(totalRevenue / memberCount),
  }))
}
