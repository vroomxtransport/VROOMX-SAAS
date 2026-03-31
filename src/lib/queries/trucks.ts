import type { SupabaseClient } from '@supabase/supabase-js'
import type { Truck } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

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

export async function fetchTrucks(
  supabase: SupabaseClient,
  filters: TruckFilters = {}
): Promise<TrucksResult> {
  const { status, truckType, search, page = 0, pageSize = 20, sortBy, sortDir } = filters

  let query = supabase
    .from('trucks')
    .select('*', { count: 'exact' })
    .order(sortBy ?? 'created_at', { ascending: sortDir === 'asc' })
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
