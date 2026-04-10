/**
 * Driving distance calculation using Mapbox Directions API v5.
 *
 * Production-grade replacement for the previous OSRM demo server
 * implementation. Uses Mapbox's commercial routing service which provides:
 *   - Street-level accuracy (vs. OSRM demo's best-effort routing)
 *   - 100k free requests/month, predictable paid tier above that
 *   - SLA-backed uptime (vs. OSRM demo's "not for production" disclaimer)
 *   - Retry-friendly HTTP semantics
 *
 * Requires MAPBOX_ACCESS_TOKEN env var. If the token is missing, the
 * function returns null and logs a warning rather than crashing — the
 * caller (geocoding-helpers.ts) already treats null as a fire-and-forget
 * failure, so existing orders continue to work without a token.
 *
 * NOTE on truck routing: Mapbox's standard `driving` profile is optimized
 * for passenger cars and does not account for truck-specific restrictions
 * (low bridges, weight limits, hazmat routing). For auto-transport rigs
 * this is an acceptable approximation but not PC*MILER-accurate. Upgrading
 * to a dedicated trucking routing engine (Google Routes API truck mode,
 * HERE HGV profile, or PC*MILER) is a future enhancement.
 */

interface DistanceResult {
  miles: number
  durationMinutes: number
}

const MAPBOX_DIRECTIONS_BASE = 'https://api.mapbox.com/directions/v5/mapbox/driving'
const REQUEST_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 500

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate driving distance and duration between two coordinates.
 * Retries up to MAX_ATTEMPTS on network/5xx errors with exponential backoff.
 * Returns null on:
 *   - Missing MAPBOX_ACCESS_TOKEN
 *   - Invalid coordinates (non-finite, out-of-range)
 *   - 4xx client errors (unrecoverable; no retry)
 *   - All retries exhausted
 *   - No route found between the two points
 */
export async function calculateDrivingDistance(
  pickupLat: number,
  pickupLon: number,
  deliveryLat: number,
  deliveryLon: number
): Promise<DistanceResult | null> {
  // Token presence check — gracefully degrade if not configured. The
  // caller treats null as "distance pending" in the UI.
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    console.warn('[distance] MAPBOX_ACCESS_TOKEN not set — distance calculation skipped')
    return null
  }

  // Coordinate validation — reject NaN/Infinity and out-of-range values
  // before constructing the URL. Defensive even though upstream geocoding
  // should only ever produce valid numeric coordinates.
  if (
    !isFiniteNumber(pickupLat) ||
    !isFiniteNumber(pickupLon) ||
    !isFiniteNumber(deliveryLat) ||
    !isFiniteNumber(deliveryLon) ||
    pickupLat < -90 || pickupLat > 90 ||
    deliveryLat < -90 || deliveryLat > 90 ||
    pickupLon < -180 || pickupLon > 180 ||
    deliveryLon < -180 || deliveryLon > 180
  ) {
    console.warn('[distance] invalid coordinates, skipping calculation')
    return null
  }

  // Mapbox expects lon,lat order (GeoJSON convention), semicolon-separated
  // for multi-waypoint routes. Numeric literals are safe to interpolate —
  // we've already validated they're finite numbers in range.
  const coords = `${pickupLon},${pickupLat};${deliveryLon},${deliveryLat}`
  const params = new URLSearchParams({
    access_token: token,
    overview: 'false',
    geometries: 'geojson',
  })
  const url = `${MAPBOX_DIRECTIONS_BASE}/${coords}?${params.toString()}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'VroomX-TMS/1.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      // 429 (rate limited) is transient — back off and retry with the
      // 5xx path so a brief burst doesn't silently kill distance calc.
      // Other 4xx codes (401 bad token, 422 bad coords, 403 quota) are
      // unrecoverable — log and bail.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[distance] Mapbox ${response.status} (unrecoverable) on attempt ${attempt}`)
        return null
      }

      // 5xx and 429 are transient — retry with backoff.
      if (!response.ok) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
          continue
        }
        console.error(`[distance] Mapbox ${response.status} after ${MAX_ATTEMPTS} attempts`)
        return null
      }

      const data = await response.json()

      if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) {
        console.warn(`[distance] no route found between points`)
        return null
      }

      const route = data.routes[0]
      if (!isFiniteNumber(route.distance) || !isFiniteNumber(route.duration)) {
        console.warn('[distance] Mapbox response missing numeric distance/duration')
        return null
      }

      const miles = route.distance / 1609.34
      const durationMinutes = route.duration / 60

      return {
        miles: Math.round(miles * 10) / 10, // 1 decimal precision
        durationMinutes: Math.round(durationMinutes),
      }
    } catch (err) {
      // AbortError (timeout) or network error — retry if budget remains
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
        continue
      }
      const msg = err instanceof Error ? err.message : 'unknown error'
      console.error(`[distance] Mapbox fetch failed after ${MAX_ATTEMPTS} attempts: ${msg}`)
      return null
    }
  }

  return null
}
