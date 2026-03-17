import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceRecord } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface MaintenanceFilters {
  truckId?: string
  maintenanceType?: string
  status?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface MaintenanceResult {
  records: MaintenanceRecord[]
  total: number
}

export interface MaintenanceCounts {
  scheduled: number
  in_progress: number
  completed: number
}

export async function fetchMaintenanceRecords(
  supabase: SupabaseClient,
  filters: MaintenanceFilters = {}
): Promise<MaintenanceResult> {
  const {
    truckId,
    maintenanceType,
    status,
    search,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
    page = 0,
    pageSize = 20,
  } = filters

  // Determine sort column — only allow known columns to prevent injection
  const allowedSortFields: Record<string, string> = {
    scheduled_date: 'scheduled_date',
    cost: 'cost',
    created_at: 'created_at',
    completed_date: 'completed_date',
  }
  const orderField = (sortBy && allowedSortFields[sortBy]) ?? 'scheduled_date'
  const ascending = sortDir === 'asc'

  let query = supabase
    .from('maintenance_records')
    .select('*, truck:trucks(id, unit_number)', { count: 'exact' })
    .order(orderField, { ascending })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (truckId) {
    query = query.eq('truck_id', truckId)
  }

  if (maintenanceType) {
    query = query.eq('maintenance_type', maintenanceType)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `description.ilike.%${s}%,vendor.ilike.%${s}%,notes.ilike.%${s}%`
      )
    }
  }

  if (dateFrom) {
    query = query.gte('scheduled_date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('scheduled_date', dateTo)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    records: (data ?? []) as MaintenanceRecord[],
    total: count ?? 0,
  }
}

export async function fetchMaintenanceRecord(
  supabase: SupabaseClient,
  id: string
): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*, truck:trucks(id, unit_number)')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as MaintenanceRecord
}

export async function fetchMaintenanceCounts(
  supabase: SupabaseClient
): Promise<MaintenanceCounts> {
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('status')

  if (error) throw error

  const counts: MaintenanceCounts = {
    scheduled: 0,
    in_progress: 0,
    completed: 0,
  }

  for (const row of data ?? []) {
    const s = row.status as keyof MaintenanceCounts
    if (s in counts) {
      counts[s]++
    }
  }

  return counts
}
