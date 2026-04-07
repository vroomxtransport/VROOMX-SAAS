import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trip, Driver, Truck } from '@/types/database'
import type { TripStatus } from '@/types'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface TripFilters {
  status?: TripStatus
  driverId?: string
  truckId?: string
  startDate?: string // filter trips starting on or after this date
  endDate?: string // filter trips ending on or before this date
  search?: string // search by trip_number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface TripWithRelations extends Trip {
  driver: Pick<Driver, 'id' | 'first_name' | 'last_name' | 'driver_type' | 'pay_type' | 'pay_rate'> | null
  truck: Pick<Truck, 'id' | 'unit_number' | 'truck_type'> | null
}

export interface TripsResult {
  trips: TripWithRelations[]
  total: number
}

const TRIP_SELECT = '*, driver:drivers(id, first_name, last_name, driver_type, pay_type, pay_rate), truck:trucks(id, unit_number, truck_type)'

// SCAN-008: whitelist sortable columns to block column-injection via
// unvalidated URL params. PostgREST rejects unknown columns with a 400
// rather than leaking data, but an unbounded allowlist lets a caller
// sort on any indexed column (useful for enumeration + DoS via slow
// sorts on unindexed columns). Matches the pattern already in fuel.ts.
const TRIP_ALLOWED_SORT_COLUMNS = [
  'created_at', 'trip_number', 'status', 'start_date', 'end_date',
  'total_revenue', 'driver_pay', 'net_profit',
]
const TRIP_DEFAULT_SORT = 'created_at'

export async function fetchTrips(
  supabase: SupabaseClient,
  filters: TripFilters = {}
): Promise<TripsResult> {
  const { status, driverId, truckId, startDate, endDate, search, sortBy, sortDir, page = 0 } = filters
  const pageSize = clampPageSize(filters.pageSize)

  const resolvedSortBy =
    sortBy && TRIP_ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : TRIP_DEFAULT_SORT

  let query = supabase
    .from('trips')
    .select(TRIP_SELECT, { count: 'exact' })
    .order(resolvedSortBy, { ascending: sortDir === 'asc' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (truckId) {
    query = query.eq('truck_id', truckId)
  }

  if (startDate) {
    query = query.gte('start_date', startDate)
  }

  if (endDate) {
    query = query.lte('end_date', endDate)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.ilike('trip_number', `%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trips: (data ?? []) as TripWithRelations[],
    total: count ?? 0,
  }
}

export async function fetchTrip(
  supabase: SupabaseClient,
  id: string
): Promise<TripWithRelations> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as TripWithRelations
}
