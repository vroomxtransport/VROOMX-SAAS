import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDrive } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface LocalDriveFilters {
  status?: string
  type?: string
  terminalId?: string
  search?: string
  driverId?: string
  tripId?: string
  unassignedOnly?: boolean
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface LocalDrivesResult {
  localDrives: LocalDrive[]
  total: number
}

export async function fetchLocalDrives(
  supabase: SupabaseClient,
  filters: LocalDriveFilters = {}
): Promise<LocalDrivesResult> {
  const { status, type, terminalId, search, driverId, tripId, dateFrom, dateTo, sortBy, sortDir, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('local_drives')
    .select('*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number), order:orders(id, order_number, vehicle_make, vehicle_model, vehicle_vin), terminal:terminals(id, name)', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (type) {
    query = query.eq('type', type)
  }

  if (terminalId) {
    query = query.eq('terminal_id', terminalId)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  if (filters.unassignedOnly) {
    query = query.is('local_run_id', null)
  }

  if (dateFrom) {
    query = query.gte('scheduled_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('scheduled_date', dateTo)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`pickup_city.ilike.%${s}%,delivery_city.ilike.%${s}%,pickup_location.ilike.%${s}%,delivery_location.ilike.%${s}%`)
    }
  }

  // Apply sort — default to created_at desc
  if (sortBy) {
    query = query.order(sortBy, { ascending: sortDir === 'asc' })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    localDrives: (data ?? []) as LocalDrive[],
    total: count ?? 0,
  }
}

export async function fetchLocalDrive(
  supabase: SupabaseClient,
  id: string
): Promise<LocalDrive> {
  const { data, error } = await supabase
    .from('local_drives')
    .select('*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number), order:orders(id, order_number, vehicle_make, vehicle_model, vehicle_vin), terminal:terminals(id, name)')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as LocalDrive
}
