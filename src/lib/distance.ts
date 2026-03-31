/**
 * Driving distance calculation using OSRM (Open Source Routing Machine).
 * Free, no API key required. Uses the public demo server.
 *
 * Rate limits: The public OSRM server is generous but not unlimited.
 * For high-volume production use, consider self-hosting OSRM.
 */

interface DistanceResult {
  miles: number
  durationMinutes: number
}

/**
 * Calculate driving distance and duration between two coordinates.
 * Returns null if the API call fails or no route is found.
 */
export async function calculateDrivingDistance(
  pickupLat: number,
  pickupLon: number,
  deliveryLat: number,
  deliveryLon: number
): Promise<DistanceResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${deliveryLon},${deliveryLat}?overview=false`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'VroomX-TMS/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const data = await response.json()

    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    const route = data.routes[0]
    const miles = route.distance / 1609.34
    const durationMinutes = route.duration / 60

    return {
      miles: Math.round(miles * 10) / 10, // Round to 1 decimal
      durationMinutes: Math.round(durationMinutes),
    }
  } catch {
    console.error('[distance] OSRM API call failed')
    return null
  }
}
