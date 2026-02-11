import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, Broker, Driver } from '@/types/database'

export interface OrderFilters {
  status?: string
  brokerId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface OrderWithRelations extends Order {
  broker: Pick<Broker, 'id' | 'name'> | null
  driver: Pick<Driver, 'id' | 'first_name' | 'last_name'> | null
}

export interface OrdersResult {
  orders: OrderWithRelations[]
  total: number
}

export async function fetchOrders(
  supabase: SupabaseClient,
  filters: OrderFilters = {}
): Promise<OrdersResult> {
  const { status, brokerId, driverId, dateFrom, dateTo, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('orders')
    .select('*, broker:brokers(id, name), driver:drivers(id, first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (brokerId) {
    query = query.eq('broker_id', brokerId)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo)
  }

  if (search) {
    query = query.or(`vehicle_vin.ilike.%${search}%,vehicle_make.ilike.%${search}%,order_number.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    orders: (data ?? []) as OrderWithRelations[],
    total: count ?? 0,
  }
}

export async function fetchOrder(
  supabase: SupabaseClient,
  id: string
): Promise<OrderWithRelations> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, broker:brokers(id, name), driver:drivers(id, first_name, last_name)')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as OrderWithRelations
}
