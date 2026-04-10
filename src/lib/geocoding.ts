/**
 * Server-side geocoding using Mapbox Geocoding API v6.
 *
 * Production-grade replacement for the previous Nominatim (OpenStreetMap)
 * implementation. Mapbox provides:
 *   - Street-level address resolution (vs. Nominatim's city-centroid
 *     fallback when a house number is missing or unrecognized)
 *   - 100k free requests/month, paid tier above that
 *   - No global 1 req/sec rate limit (Nominatim's policy prohibits bulk
 *     commercial use and throttles hard)
 *   - Structured error codes for retry decisions
 *
 * Requires MAPBOX_ACCESS_TOKEN env var. If the token is missing, the
 * function returns null and logs a warning — orders continue to work
 * without coordinates, just without auto-calculated distance.
 */

const REQUEST_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 500

const MAPBOX_GEOCODING_BASE = 'https://api.mapbox.com/search/geocode/v6/forward'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface GeocodingResult {
  latitude: number
  longitude: number
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

export async function geocodeAddress(
  location: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined
): Promise<GeocodingResult | null> {
  // Need at least city + state for a meaningful geocode
  if (!city || !state) return null

  // Token presence check — gracefully degrade if not configured
  const token = process.env.MAPBOX_ACCESS_TOKEN
  if (!token) {
    console.warn('[geocoding] MAPBOX_ACCESS_TOKEN not set — geocoding skipped')
    return null
  }

  // Build address query — more specific = more accurate. Mapbox's v6
  // forward endpoint accepts a free-text query via ?q= and ranks results
  // by relevance; we ask for limit=1 and filter to US addresses.
  const parts: string[] = []
  if (location) parts.push(location)
  parts.push(city)
  parts.push(state)
  if (zip) parts.push(zip)
  const query = parts.join(', ')

  // PII-safe identifier for log lines — city/state only is enough to debug
  // geocoding misses without leaking the full street address. The raw
  // `query` is sent in the URL but never logged directly: Sentry's
  // scrubber strips URL query strings, but console breadcrumb args are
  // captured as-is, so we keep the visible log surface address-free.
  const logHint = `${city}, ${state}`

  // URLSearchParams handles URL-encoding of the free-text query safely —
  // no manual concat, no injection risk even if addresses contain `&`, `#`, etc.
  const params = new URLSearchParams({
    q: query,
    access_token: token,
    country: 'us',
    limit: '1',
    types: 'address,postcode,place',
  })
  const url = `${MAPBOX_GEOCODING_BASE}?${params.toString()}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'VroomX-TMS/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      // 429 is transient — back off and retry. Other 4xx codes
      // (401 bad token, 422 bad query, 403 quota) are unrecoverable.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[geocoding] Mapbox ${response.status} (unrecoverable) for ${logHint}`)
        return null
      }

      if (!response.ok) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
          continue
        }
        console.error(`[geocoding] Mapbox ${response.status} after ${MAX_ATTEMPTS} attempts for ${logHint}`)
        return null
      }

      const data = await response.json()

      // Mapbox v6 returns GeoJSON FeatureCollection
      const features = data?.features
      if (!Array.isArray(features) || features.length === 0) {
        console.warn(`[geocoding] No results for ${logHint}`)
        return null
      }

      // v6 shape: features[0].geometry.coordinates = [lon, lat]
      const coords = features[0]?.geometry?.coordinates
      if (!Array.isArray(coords) || coords.length < 2) {
        console.warn(`[geocoding] Malformed coordinates in Mapbox response for ${logHint}`)
        return null
      }

      const [lon, lat] = coords
      if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
        console.warn(`[geocoding] Non-numeric coordinates in Mapbox response for ${logHint}`)
        return null
      }

      return { latitude: lat, longitude: lon }
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
        continue
      }
      const msg = err instanceof Error ? err.message : 'unknown error'
      console.error(`[geocoding] Failed after ${MAX_ATTEMPTS} attempts for ${logHint}: ${msg}`)
      return null
    }
  }

  return null
}
