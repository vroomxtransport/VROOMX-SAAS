import type { SupabaseClient } from '@supabase/supabase-js'
import type { Truck } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface TruckFilters {
  status?: string
  truckType?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface TrucksResult {
  trucks: Truck[]
  total: number
}

// SCAN-008: allowlist to block column-injection via unvalidated sortBy.
// Must match actual columns in the trucks table (src/db/schema.ts:192-210).
const TRUCK_ALLOWED_SORT_COLUMNS = [
  'created_at', 'unit_number', 'make', 'model', 'year',
  'truck_type', 'truck_status', 'vin', 'ownership',
]
const TRUCK_DEFAULT_SORT = 'created_at'

export async function fetchTrucks(
  supabase: SupabaseClient,
  filters: TruckFilters = {}
): Promise<TrucksResult> {
  const { status, truckType, search, page = 0, sortBy, sortDir } = filters
  const pageSize = clampPageSize(filters.pageSize)

  const resolvedSortBy =
    sortBy && TRUCK_ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : TRUCK_DEFAULT_SORT

  let query = supabase
    .from('trucks')
    .select('*', { count: 'exact' })
    .order(resolvedSortBy, { ascending: sortDir === 'asc' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('truck_status', status)
  }

  if (truckType) {
    query = query.eq('truck_type', truckType)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `unit_number.ilike.%${s}%,make.ilike.%${s}%,model.ilike.%${s}%`
      )
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trucks: (data ?? []) as Truck[],
    total: count ?? 0,
  }
}

/**
 * Lightweight query for dropdowns — only id + unit_number, no pagination.
 */
export async function fetchTruckOptions(
  supabase: SupabaseClient
): Promise<{ id: string; unit_number: string }[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, unit_number')
    .order('unit_number')

  if (error) throw error
  return (data ?? []) as { id: string; unit_number: string }[]
}

export async function fetchTruck(
  supabase: SupabaseClient,
  id: string
): Promise<Truck> {
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Truck
}
