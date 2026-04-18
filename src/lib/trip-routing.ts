import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateMultiWaypointRoute, type RouteGeometry } from '@/lib/distance'
import type { RouteStop } from '@/types/database'

export type RecomputeSkipReason =
  | 'MISSING_SEQUENCE'
  | 'TOO_MANY_STOPS'
  | 'MISSING_COORDS'
  | 'MAPBOX_FAILED'

export interface RecomputeOutcome {
  ok: boolean
  reason?: RecomputeSkipReason
  geometry?: RouteGeometry
  meters?: number
  durationSeconds?: number
}

interface OrderCoordsRow {
  id: string
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_latitude: number | null
  delivery_longitude: number | null
}

/**
 * Recompute the cached Mapbox driving polyline for a trip, walking
 * every stop in `route_sequence` order through ONE Directions call,
 * and persist `route_geometry`, `route_distance_meters`,
 * `route_duration_seconds` back to the trip.
 *
 * This produces a single road-following polyline through every stop
 * (replacing the per-order pickup→delivery polylines + dashed
 * straight-line connector that used to render).
 *
 * Skip-reason semantics:
 * - MISSING_SEQUENCE — trip has no `route_sequence` saved yet (the
 *   dispatcher hasn't ordered the stops). The map renders the legacy
 *   fallback in the meantime.
 * - TOO_MANY_STOPS — Mapbox Directions caps at 25 waypoints. Trips
 *   above that fall back to per-order rendering. Almost no real
 *   car-haul trip hits this.
 * - MISSING_COORDS — at least one stop is ungeocoded. The
 *   geocode-failure banner already surfaces this; we don't try to
 *   route a partial trip.
 * - MAPBOX_FAILED — Mapbox returned no route, errored, or timed out.
 *   The previous geometry (if any) stays in place.
 *
 * Tenant scoping: every read + write goes through `.eq('tenant_id',
 * tenantId)` to defend against a tampered `tripId` reaching this
 * helper from anywhere upstream.
 */
export async function recomputeTripRouteGeometry(
  supabase: SupabaseClient,
  tripId: string,
  tenantId: string,
): Promise<RecomputeOutcome> {
  // 1. Trip row — need the saved sequence.
  const { data: trip } = await supabase
    .from('trips')
    .select('id, route_sequence')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()

  const sequence = (trip?.route_sequence ?? null) as RouteStop[] | null
  if (!sequence || sequence.length < 2) {
    return { ok: false, reason: 'MISSING_SEQUENCE' }
  }

  if (sequence.length > 25) {
    return { ok: false, reason: 'TOO_MANY_STOPS' }
  }

  // 2. Pull coords for every order referenced by the sequence in one
  // tenant-scoped query.
  const orderIds = Array.from(new Set(sequence.map((s) => s.orderId)))
  const { data: orderRows } = await supabase
    .from('orders')
    .select('id, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude')
    .in('id', orderIds)
    .eq('tenant_id', tenantId)
  const orderMap = new Map<string, OrderCoordsRow>()
  for (const row of (orderRows ?? []) as OrderCoordsRow[]) {
    orderMap.set(row.id, row)
  }

  // 3. Walk the sequence into a `[lon, lat][]` waypoint list.
  const coords: Array<[number, number]> = []
  for (const stop of sequence) {
    const order = orderMap.get(stop.orderId)
    if (!order) return { ok: false, reason: 'MISSING_COORDS' }
    const lat = stop.stopType === 'pickup' ? order.pickup_latitude : order.delivery_latitude
    const lon = stop.stopType === 'pickup' ? order.pickup_longitude : order.delivery_longitude
    if (lat == null || lon == null) {
      return { ok: false, reason: 'MISSING_COORDS' }
    }
    coords.push([lon, lat])
  }

  // 4. Single Mapbox call.
  const result = await calculateMultiWaypointRoute(coords)
  if (!result || !result.geometry) {
    return { ok: false, reason: 'MAPBOX_FAILED' }
  }

  // Persist. `route_distance_meters` is stored in METERS (Mapbox's
  // native unit converted from miles for storage precision); the
  // financials path divides by 1609.344 to derive `total_miles`.
  const meters = result.miles * 1609.344
  const durationSeconds = result.durationMinutes * 60

  const { error: updateError } = await supabase
    .from('trips')
    .update({
      route_geometry: result.geometry,
      route_distance_meters: String(Math.round(meters * 100) / 100),
      route_duration_seconds: Math.round(durationSeconds),
    })
    .eq('id', tripId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    console.error(`[trip-routing] Failed to persist route for trip ${tripId}:`, updateError.message)
    return { ok: false, reason: 'MAPBOX_FAILED' }
  }

  return {
    ok: true,
    geometry: result.geometry,
    meters,
    durationSeconds,
  }
}
