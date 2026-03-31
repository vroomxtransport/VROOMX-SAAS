import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalRun } from '@/types/database'

export interface LocalRunFilters {
  status?: string
  terminalId?: string
  driverId?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface LocalRunsResult {
  localRuns: LocalRun[]
  total: number
}

export async function fetchLocalRuns(
  supabase: SupabaseClient,
  filters: LocalRunFilters = {}
): Promise<LocalRunsResult> {
  const { status, terminalId, driverId, type, dateFrom, dateTo, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('local_runs')
    .select('*, terminal:terminals(id, name), driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number), local_drives(id)', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) query = query.eq('status', status)
  if (terminalId) query = query.eq('terminal_id', terminalId)
  if (driverId) query = query.eq('driver_id', driverId)
  if (type) query = query.eq('type', type)
  if (dateFrom) query = query.gte('scheduled_date', dateFrom)
  if (dateTo) query = query.lte('scheduled_date', dateTo)

  query = query.order('created_at', { ascending: false })

  const { data, error, count } = await query
  if (error) throw error

  return {
    localRuns: (data ?? []) as LocalRun[],
    total: count ?? 0,
  }
}

export async function fetchLocalRun(
  supabase: SupabaseClient,
  id: string
): Promise<LocalRun> {
  const { data, error } = await supabase
    .from('local_runs')
    .select('*, terminal:terminals(id, name), driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number), local_drives(*, order:orders(id, order_number, vehicle_make, vehicle_model))')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as LocalRun
}
