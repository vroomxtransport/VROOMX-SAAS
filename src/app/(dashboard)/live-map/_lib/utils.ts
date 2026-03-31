import type { DriverLocation, SamsaraVehicleLocation } from '@/types/database'
import type { FleetUnit, FleetUnitStatus } from './types'

export const STATUS_COLORS = {
  moving: '#059669',
  idle: '#d97706',
  offline: '#6b7280',
} as const

export const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000

export function deriveStatus(speed: number, lastUpdate: string): FleetUnitStatus {
  const age = Date.now() - new Date(lastUpdate).getTime()
  if (age > OFFLINE_THRESHOLD_MS) return 'offline'
  if (speed > 0) return 'moving'
  return 'idle'
}

export function normalizeDriverLocations(locations: DriverLocation[]): FleetUnit[] {
  return locations.map((loc) => {
    const name = loc.driver
      ? `${loc.driver.first_name} ${loc.driver.last_name}`
      : 'Unknown Driver'
    const status = deriveStatus(loc.speed ?? 0, loc.updated_at)

    return {
      id: `driver-${loc.id}`,
      type: 'driver' as const,
      name,
      subtitle: loc.driver?.driver_status ?? null,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed ?? 0,
      heading: loc.heading ?? null,
      lastUpdate: loc.updated_at,
      status,
      linkHref: loc.driver ? `/drivers/${loc.driver.id}` : null,
    }
  })
}

export function normalizeVehicleLocations(vehicles: SamsaraVehicleLocation[]): FleetUnit[] {
  return vehicles
    .filter((v) => v.last_latitude != null && v.last_longitude != null)
    .map((v) => {
      const name = v.truck?.unit_number
        ? `Unit #${v.truck.unit_number}`
        : v.samsara_name ?? 'Unknown Vehicle'
      const subtitle = v.samsara_name && v.truck?.unit_number ? v.samsara_name : null
      const lastUpdate = v.last_location_time ?? new Date().toISOString()
      const speed = v.last_speed ?? 0
      const status = deriveStatus(speed, lastUpdate)

      return {
        id: `vehicle-${v.id}`,
        type: 'vehicle' as const,
        name,
        subtitle,
        latitude: v.last_latitude!,
        longitude: v.last_longitude!,
        speed,
        heading: v.last_heading ?? null,
        lastUpdate,
        status,
        linkHref: v.truck?.id ? `/trucks/${v.truck.id}` : null,
      }
    })
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export function headingToCompass(deg: number | null): string | null {
  if (deg == null) return null
  const index = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return COMPASS_POINTS[index]
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
