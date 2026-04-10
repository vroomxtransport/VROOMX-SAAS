import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, Broker, Driver, Trip, OrderActivityLog } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface OrderFilters {
  status?: string
  brokerId?: string
  driverId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  paymentStatuses?: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface OrderWithRelations extends Order {
  broker: Pick<Broker, 'id' | 'name' | 'email'> | null
  driver: Pick<Driver, 'id' | 'first_name' | 'last_name'> | null
  trip: Pick<Trip, 'id' | 'trip_number' | 'status'> | null
}

export interface OrdersResult {
  orders: OrderWithRelations[]
  total: number
}

// SCAN-008: allowlist to block column-injection via unvalidated sortBy.
// Covers the columns the orders table UI exposes as sortable headers.
const ORDER_ALLOWED_SORT_COLUMNS = [
  'created_at', 'order_number', 'status', 'payment_status',
  'carrier_pay', 'broker_fee', 'local_fee', 'pickup_city', 'delivery_city',
  'invoice_date', 'revenue', 'distance_miles',
]
const ORDER_DEFAULT_SORT = 'created_at'

export async function fetchOrders(
  supabase: SupabaseClient,
  filters: OrderFilters = {}
): Promise<OrdersResult> {
  const { status, brokerId, driverId, dateFrom, dateTo, search, paymentStatuses, sortBy, sortDir, page = 0 } = filters
  const pageSize = clampPageSize(filters.pageSize)

  const resolvedSortBy =
    sortBy && ORDER_ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : ORDER_DEFAULT_SORT
  // Preserve previous behavior: when the caller passes an explicit sortBy,
  // default direction is ascending; otherwise (no sortBy) default to
  // descending by created_at (newest first).
  const ascending = sortBy ? sortDir === 'asc' : false

  let query = supabase
    .from('orders')
    .select('vehicles, *, broker:brokers(id, name, email), driver:drivers(id, first_name, last_name), trip:trips(id, trip_number, status)', { count: 'exact' })
    .order(resolvedSortBy, { ascending })
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

  if (paymentStatuses && paymentStatuses.length > 0) {
    query = query.in('payment_status', paymentStatuses)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`vehicle_vin.ilike.%${s}%,vehicle_make.ilike.%${s}%,order_number.ilike.%${s}%`)
    }
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
    .select('vehicles, *, broker:brokers(id, name, email), driver:drivers(id, first_name, last_name), trip:trips(id, trip_number, status)')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as OrderWithRelations
}

export async function fetchOrderActivityLog(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderActivityLog[]> {
  const { data, error } = await supabase
    .from('order_activity_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return (data ?? []) as OrderActivityLog[]
}
