import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceRecord } from '@/types/database'

export interface MaintenanceFilters {
  truckId?: string
  maintenanceType?: string
  status?: string
  search?: string
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
  const { truckId, maintenanceType, status, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('maintenance_records')
    .select('*, truck:trucks(id, unit_number)', { count: 'exact' })
    .order('scheduled_date', { ascending: false })
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
    query = query.or(
      `description.ilike.%${search}%,vendor.ilike.%${search}%,notes.ilike.%${search}%`
    )
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
