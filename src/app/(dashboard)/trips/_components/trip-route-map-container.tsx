'use client'

import dynamic from 'next/dynamic'
import type { Order, RouteStop } from '@/types/database'

const TripRouteMapView = dynamic(
  () => import('./trip-route-map-view').then((m) => ({ default: m.TripRouteMapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-lg border bg-[var(--map-bg)] sm:h-[400px] lg:h-[480px]">
        <p className="text-sm text-muted-foreground">Loading map…</p>
      </div>
    ),
  }
)

interface TripRouteMapContainerProps {
  orders: Order[]
  sequence: RouteStop[] | null
  /** Cached trip-level Mapbox driving polyline. Pass-through to map view. */
  tripRouteGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null
}

/**
 * Wraps the Leaflet map in a responsive height container.
 *
 * - Empty state (no geocoded orders at all) is handled inside
 *   `TripRouteMapView` itself — it returns a centered "No geocoded
 *   orders…" message.
 * - Partial geocode failures (some orders mappable, some not) are
 *   announced by `TripRouteSection` as a banner above the map.
 * - Tile-fetch failures are visually masked by the `--map-bg` fill on
 *   this wrapper: when Mapbox returns 401/429 and tiles don't paint,
 *   the user sees the warm beige base instead of a checkerboard.
 */
export function TripRouteMapContainer({ orders, sequence, tripRouteGeometry }: TripRouteMapContainerProps) {
  return (
    <div className="h-[280px] overflow-hidden rounded-lg border bg-[var(--map-bg)] sm:h-[400px] lg:h-[480px]">
      <TripRouteMapView orders={orders} sequence={sequence} tripRouteGeometry={tripRouteGeometry} />
    </div>
  )
}
