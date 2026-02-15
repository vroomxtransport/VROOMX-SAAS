import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDrive } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

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
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(`pickup_city.ilike.%${s}%,delivery_city.ilike.%${s}%,pickup_location.ilike.%${s}%,delivery_location.ilike.%${s}%`)
    }
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
