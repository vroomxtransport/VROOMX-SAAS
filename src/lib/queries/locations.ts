import type { SupabaseClient } from '@supabase/supabase-js'
import type { DriverLocation } from '@/types/database'

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
