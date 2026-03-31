import type { SupabaseClient } from '@supabase/supabase-js'
import type { DriverLocation, SamsaraVehicleLocation } from '@/types/database'

export async function fetchLatestLocations(supabase: SupabaseClient): Promise<DriverLocation[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('*, driver:drivers(id, first_name, last_name, driver_status)')
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Deduplicate - keep only latest per driver
  const seen = new Set<string>()
  const unique: DriverLocation[] = []
  for (const loc of (data ?? []) as DriverLocation[]) {
    if (!seen.has(loc.driver_id)) {
      seen.add(loc.driver_id)
      unique.push(loc)
    }
  }
  return unique
}

export async function fetchSamsaraVehicleLocations(
  supabase: SupabaseClient
): Promise<SamsaraVehicleLocation[]> {
  const { data, error } = await supabase
    .from('samsara_vehicles')
    .select(
      'id, tenant_id, samsara_vehicle_id, samsara_name, truck_id, last_latitude, last_longitude, last_speed, last_heading, last_location_time, truck:trucks(id, unit_number)'
    )
    .not('last_latitude', 'is', null)
    .not('last_longitude', 'is', null)
    .order('last_location_time', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    truck: Array.isArray(row.truck) ? row.truck[0] ?? null : row.truck ?? null,
  })) as SamsaraVehicleLocation[]
}
