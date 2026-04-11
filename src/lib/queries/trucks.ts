import type { SupabaseClient } from '@supabase/supabase-js'
import type { Truck } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'
import { clampPageSize } from '@/lib/queries/pagination'

export interface TruckFilters {
  status?: string
  truckType?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface TrucksResult {
  trucks: Truck[]
  total: number
}

// SCAN-008: allowlist to block column-injection via unvalidated sortBy.
// Must match actual columns in the trucks table (src/db/schema.ts:192-210).
const TRUCK_ALLOWED_SORT_COLUMNS = [
  'created_at', 'unit_number', 'make', 'model', 'year',
  'truck_type', 'truck_status', 'vin', 'ownership',
]
const TRUCK_DEFAULT_SORT = 'created_at'

export async function fetchTrucks(
  supabase: SupabaseClient,
  filters: TruckFilters = {}
): Promise<TrucksResult> {
  const { status, truckType, search, page = 0, sortBy, sortDir } = filters
  const pageSize = clampPageSize(filters.pageSize)

  const resolvedSortBy =
    sortBy && TRUCK_ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : TRUCK_DEFAULT_SORT

  let query = supabase
    .from('trucks')
    .select('*', { count: 'exact' })
    .order(resolvedSortBy, { ascending: sortDir === 'asc' })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('truck_status', status)
  }

  if (truckType) {
    query = query.eq('truck_type', truckType)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `unit_number.ilike.%${s}%,make.ilike.%${s}%,model.ilike.%${s}%`
      )
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trucks: (data ?? []) as Truck[],
    total: count ?? 0,
  }
}

/**
 * Lightweight query for dropdowns — only id + unit_number, no pagination.
 */
export async function fetchTruckOptions(
  supabase: SupabaseClient
): Promise<{ id: string; unit_number: string }[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, unit_number')
    .order('unit_number')

  if (error) throw error
  return (data ?? []) as { id: string; unit_number: string }[]
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

// ============================================================================
// Odometer resolver (Wave 3)
// ============================================================================

export type OdometerSource = 'samsara' | 'fuel_entry' | 'maintenance'

export interface LatestOdometer {
  /** Odometer reading in MILES (canonical unit — Samsara reports meters, we convert at the boundary) */
  miles: number
  /** ISO timestamp of the reading */
  readingAt: string
  /** Where the value came from */
  source: OdometerSource
}

const METERS_PER_MILE = 1609.344

/**
 * Return the most recent odometer reading for a truck, picking the newest of:
 *  - samsara_vehicles.last_odometer_meters (if Samsara is connected + mapped)
 *  - max(fuel_entries.odometer) for that truck
 *  - max(maintenance_records.odometer) for completed maintenance on that truck
 *
 * Returns null if none of the three sources have a reading. All three queries
 * run in parallel and rely on RLS for tenant isolation, consistent with the
 * existing src/lib/queries/* convention.
 */
export async function getLatestOdometer(
  supabase: SupabaseClient,
  truckId: string,
): Promise<LatestOdometer | null> {
  const [samsaraRes, fuelRes, maintRes] = await Promise.all([
    supabase
      .from('samsara_vehicles')
      .select('last_odometer_meters, last_odometer_time')
      .eq('truck_id', truckId)
      .gt('last_odometer_meters', 0)
      .not('last_odometer_time', 'is', null)
      .order('last_odometer_time', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('fuel_entries')
      .select('odometer, date, created_at')
      .eq('truck_id', truckId)
      .gt('odometer', 0)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('maintenance_records')
      .select('odometer, completed_date')
      .eq('truck_id', truckId)
      .eq('status', 'completed')
      .gt('odometer', 0)
      .order('completed_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])

  const candidates: LatestOdometer[] = []

  if (!samsaraRes.error && samsaraRes.data?.last_odometer_meters != null) {
    const meters = Number(samsaraRes.data.last_odometer_meters)
    const time = samsaraRes.data.last_odometer_time as string | null
    if (Number.isFinite(meters) && meters > 0 && time) {
      candidates.push({
        miles: Math.round(meters / METERS_PER_MILE),
        readingAt: time,
        source: 'samsara',
      })
    }
  }

  if (!fuelRes.error && fuelRes.data?.odometer != null && fuelRes.data.date) {
    // fuel_entries.date is a DATE column — normalize to end-of-day so a
    // same-day Samsara reading doesn't automatically win the sort via its
    // sub-day timestamp. End-of-day makes fuel entries "as fresh as
    // possible" for their calendar day, which matches user expectation:
    // a fuel reading entered today represents the current mileage.
    candidates.push({
      miles: Number(fuelRes.data.odometer),
      readingAt: `${fuelRes.data.date}T23:59:59.999Z`,
      source: 'fuel_entry',
    })
  }

  if (
    !maintRes.error &&
    maintRes.data?.odometer != null &&
    maintRes.data.completed_date
  ) {
    candidates.push({
      miles: Number(maintRes.data.odometer),
      readingAt: maintRes.data.completed_date as string,
      source: 'maintenance',
    })
  }

  if (candidates.length === 0) return null

  return candidates.reduce((newest, next) =>
    next.readingAt.localeCompare(newest.readingAt) > 0 ? next : newest,
  )
}
