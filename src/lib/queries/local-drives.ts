import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDrive } from '@/types/database'

export interface LocalDriveFilters {
  status?: string
  search?: string
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
  const { status, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('local_drives')
    .select('*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number)', { count: 'exact' })
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`pickup_city.ilike.%${search}%,delivery_city.ilike.%${search}%,pickup_location.ilike.%${search}%,delivery_location.ilike.%${search}%`)
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
    .select('*, driver:drivers(id, first_name, last_name), truck:trucks(id, unit_number)')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as LocalDrive
}
