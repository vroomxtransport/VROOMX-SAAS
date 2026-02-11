import type { SupabaseClient } from '@supabase/supabase-js'
import type { Truck } from '@/types/database'

export interface TruckFilters {
  status?: string
  truckType?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface TrucksResult {
  trucks: Truck[]
  total: number
}

export async function fetchTrucks(
  supabase: SupabaseClient,
  filters: TruckFilters = {}
): Promise<TrucksResult> {
  const { status, truckType, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('trucks')
    .select('*', { count: 'exact' })
    .order('unit_number', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('truck_status', status)
  }

  if (truckType) {
    query = query.eq('truck_type', truckType)
  }

  if (search) {
    query = query.or(
      `unit_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trucks: (data ?? []) as Truck[],
    total: count ?? 0,
  }
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
