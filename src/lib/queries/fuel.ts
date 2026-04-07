import type { SupabaseClient } from '@supabase/supabase-js'
import type { FuelEntry } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface FuelFilters {
  truckId?: string
  driverId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface FuelEntriesResult {
  entries: FuelEntry[]
  total: number
}

export interface FuelStats {
  totalGallons: number
  totalCost: number
  avgCostPerGallon: number
}

export async function fetchFuelEntries(
  supabase: SupabaseClient,
  filters: FuelFilters = {}
): Promise<FuelEntriesResult> {
  const { truckId, driverId, search, dateFrom, dateTo, sortBy, sortDir, page = 0 } = filters
  const pageSize = clampPageSize(filters.pageSize)

  // Determine sort column – whitelist allowed columns to prevent injection
  const allowedSortColumns = ['date', 'gallons', 'total_cost', 'cost_per_gallon', 'location']
  const resolvedSortBy = sortBy && allowedSortColumns.includes(sortBy) ? sortBy : 'date'
  const ascending = sortDir === 'asc'

  let query = supabase
    .from('fuel_entries')
    .select('*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number)', { count: 'exact' })
    .order(resolvedSortBy, { ascending })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (truckId) {
    query = query.eq('truck_id', truckId)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`location.ilike.%${s}%,state.ilike.%${s}%,notes.ilike.%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    entries: (data ?? []) as FuelEntry[],
    total: count ?? 0,
  }
}

export async function fetchFuelStats(
  supabase: SupabaseClient
): Promise<FuelStats> {
  const { data, error } = await supabase
    .from('fuel_entries')
    .select('gallons, total_cost, cost_per_gallon')

  if (error) throw error

  const entries = data ?? []

  if (entries.length === 0) {
    return { totalGallons: 0, totalCost: 0, avgCostPerGallon: 0 }
  }

  let totalGallons = 0
  let totalCost = 0

  for (const entry of entries) {
    totalGallons += parseFloat(entry.gallons) || 0
    totalCost += parseFloat(entry.total_cost) || 0
  }

  const avgCostPerGallon = totalGallons > 0 ? totalCost / totalGallons : 0

  return { totalGallons, totalCost, avgCostPerGallon }
}
