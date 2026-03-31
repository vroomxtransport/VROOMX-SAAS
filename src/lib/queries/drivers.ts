import type { SupabaseClient } from '@supabase/supabase-js'
import type { Driver } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface DriverFilters {
  status?: string
  driverType?: string
  search?: string
  payTypes?: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface DriversResult {
  drivers: Driver[]
  total: number
}

export async function fetchDrivers(
  supabase: SupabaseClient,
  filters: DriverFilters = {}
): Promise<DriversResult> {
  const { status, driverType, search, payTypes, sortBy, sortDir, page = 0, pageSize = 20 } = filters

  // Determine sort column and direction
  const sortColumn = sortBy ?? 'last_name'
  const ascending = sortDir === 'desc' ? false : true

  let query = supabase
    .from('drivers')
    .select('*', { count: 'exact' })
    .order(sortColumn, { ascending })

  // Add secondary sort when primary is not already last_name
  if (sortColumn !== 'last_name') {
    query = query.order('last_name', { ascending: true })
  }
  if (sortColumn !== 'first_name') {
    query = query.order('first_name', { ascending: true })
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('driver_status', status)
  }

  if (driverType) {
    query = query.eq('driver_type', driverType)
  }

  if (payTypes && payTypes.length > 0) {
    query = query.in('pay_type', payTypes)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    drivers: (data ?? []) as Driver[],
    total: count ?? 0,
  }
}

/**
 * Lightweight query for dropdowns — only id + name, no pagination.
 */
export async function fetchDriverOptions(
  supabase: SupabaseClient
): Promise<{ id: string; first_name: string; last_name: string; driver_type: string }[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, driver_type')
    .order('first_name')

  if (error) throw error
  return (data ?? []) as { id: string; first_name: string; last_name: string; driver_type: string }[]
}

export async function fetchDriver(
  supabase: SupabaseClient,
  id: string
): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Driver
}
