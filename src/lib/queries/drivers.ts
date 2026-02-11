import type { SupabaseClient } from '@supabase/supabase-js'
import type { Driver } from '@/types/database'

export interface DriverFilters {
  status?: string
  driverType?: string
  search?: string
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
  const { status, driverType, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('drivers')
    .select('*', { count: 'exact' })
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('driver_status', status)
  }

  if (driverType) {
    query = query.eq('driver_type', driverType)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    drivers: (data ?? []) as Driver[],
    total: count ?? 0,
  }
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
