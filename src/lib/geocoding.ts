/**
 * Server-side geocoding using Nominatim (OpenStreetMap).
 * Free, no API key required. Rate limited to 1 request per 1.1s.
 */

let lastRequestTime = 0
const MIN_INTERVAL_MS = 1100 // Nominatim requires max 1 request/second

async function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestTime = Date.now()
}

interface GeocodingResult {
  latitude: number
  longitude: number
}

export async function geocodeAddress(
  location: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined
): Promise<GeocodingResult | null> {
  // Need at least city + state for a meaningful geocode
  if (!city || !state) return null

  await throttle()

  // Build address query — more specific = more accurate
  const parts: string[] = []
  if (location) parts.push(location)
  parts.push(city)
  parts.push(state)
  if (zip) parts.push(zip)

  const query = parts.join(', ')
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
    countrycodes: 'us',
  })

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'VroomX-TMS/1.0 (transport-management)',
        },
      }
    )

    if (!response.ok) {
      console.error(`[geocoding] Nominatim returned ${response.status} for "${query}"`)
      return null
    }

    const results = await response.json()
    if (!Array.isArray(results) || results.length === 0) {
      console.warn(`[geocoding] No results for "${query}"`)
      return null
    }

    const lat = parseFloat(results[0].lat)
    const lon = parseFloat(results[0].lon)

    if (isNaN(lat) || isNaN(lon)) return null

    return { latitude: lat, longitude: lon }
  } catch (error) {
    console.error(`[geocoding] Failed to geocode "${query}":`, error)
    return null
  }
}
