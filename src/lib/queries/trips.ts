import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trip, Driver, Truck } from '@/types/database'
import type { TripStatus } from '@/types'

export interface TripFilters {
  status?: TripStatus
  driverId?: string
  truckId?: string
  startDate?: string // filter trips starting on or after this date
  endDate?: string // filter trips ending on or before this date
  search?: string // search by trip_number
  page?: number
  pageSize?: number
}

export interface TripWithRelations extends Trip {
  driver: Pick<Driver, 'id' | 'first_name' | 'last_name' | 'driver_type' | 'pay_type' | 'pay_rate'> | null
  truck: Pick<Truck, 'id' | 'unit_number' | 'truck_type'> | null
}

export interface TripsResult {
  trips: TripWithRelations[]
  total: number
}

const TRIP_SELECT = '*, driver:drivers(id, first_name, last_name, driver_type, pay_type, pay_rate), truck:trucks(id, unit_number, truck_type)'

export async function fetchTrips(
  supabase: SupabaseClient,
  filters: TripFilters = {}
): Promise<TripsResult> {
  const { status, driverId, truckId, startDate, endDate, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('trips')
    .select(TRIP_SELECT, { count: 'exact' })
    .order('start_date', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  if (truckId) {
    query = query.eq('truck_id', truckId)
  }

  if (startDate) {
    query = query.gte('start_date', startDate)
  }

  if (endDate) {
    query = query.lte('end_date', endDate)
  }

  if (search) {
    query = query.ilike('trip_number', `%${search}%`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trips: (data ?? []) as TripWithRelations[],
    total: count ?? 0,
  }
}

export async function fetchTrip(
  supabase: SupabaseClient,
  id: string
): Promise<TripWithRelations> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error

  return data as TripWithRelations
}
