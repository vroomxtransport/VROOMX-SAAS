'use client'

import { useMemo } from 'react'
import { Polyline } from 'react-leaflet'

type LatLng = [number, number]

interface RoutePolylineProps {
  /** [lat, lng] coordinate pairs in draw order. */
  positions: LatLng[]
  /**
   * `driving` — Mapbox-derived road-following geometry. Renders a
   * solid navy stroke with a white casing halo (Linear-map look) +
   * tangent chevron decorators every ~120px to signal direction
   * without animation.
   *
   * `sequence` — straight-line connector between stops when no road
   * geometry is available. Renders a single thin navy dashed line at
   * 35% opacity. No casing, no chevrons — signals "uncertain path".
   */
  mode: 'driving' | 'sequence'
}

const DRIVING_NAVY = '#192334'
const CASING_WHITE = '#ffffff'

/**
 * Reusable polyline pair for the trip route map. The `driving` mode
 * draws TWO Polyline elements stacked: a 5.5px white casing
 * underneath, then a 3.5px navy stroke on top. This casing pattern is
 * what makes Mapbox / Linear maps read crisp at any zoom over any
 * background tile colour.
 *
 * Direction chevrons are intentionally STATIC tangent-aligned glyphs
 * rendered as a third Polyline-of-points-as-arrows is not a thing in
 * react-leaflet. A future Phase 2 can swap to leaflet-polylinedecorator
 * if we need richer chevron control; for Phase 1 we ship without
 * chevrons rather than introduce a new dep, and rely on the casing +
 * sequence numbers to communicate flow.
 */
export function RoutePolyline({ positions, mode }: RoutePolylineProps) {
  const validPositions = useMemo(
    () => positions.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])),
    [positions],
  )

  // Surface silent coordinate drops so a malformed Mapbox payload
  // doesn't render a quietly-shortened route. Dev-only: production
  // builds tree-shake `process.env.NODE_ENV !== 'production'` checks.
  if (process.env.NODE_ENV !== 'production' && validPositions.length !== positions.length) {
    console.warn(
      `[RoutePolyline] dropped ${positions.length - validPositions.length} invalid coord(s) (mode=${mode})`,
    )
  }

  if (validPositions.length < 2) return null

  if (mode === 'sequence') {
    return (
      <Polyline
        positions={validPositions}
        pathOptions={{
          color: DRIVING_NAVY,
          weight: 2,
          opacity: 0.35,
          dashArray: '2 6',
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    )
  }

  // driving — casing first so the navy stroke sits cleanly on top.
  return (
    <>
      <Polyline
        positions={validPositions}
        pathOptions={{
          color: CASING_WHITE,
          weight: 5.5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <Polyline
        positions={validPositions}
        pathOptions={{
          color: DRIVING_NAVY,
          weight: 3.5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  )
}
