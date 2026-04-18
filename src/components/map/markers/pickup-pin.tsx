'use client'

import L from 'leaflet'
import { renderPinSvg, pinClassName } from './pin-svg'
import type { MarkerState } from './marker-tokens'

interface CreatePickupIconArgs {
  sequence: number
  vehicleCount?: number
  failed?: boolean
  state?: MarkerState
}

/**
 * Build a Leaflet `DivIcon` for a pickup stop. The icon body is the
 * SVG rendered by `pin-svg` — a white rounded shield with navy
 * stroke + navy badge + ▲ glyph + sequence number.
 *
 * Caller is responsible for memoizing the result per
 * (sequence, vehicleCount, state) so realtime ticks don't re-mount
 * markers on every order subscription event.
 */
export function createPickupIcon({
  sequence,
  vehicleCount,
  failed,
  state = 'default',
}: CreatePickupIconArgs): L.DivIcon {
  return L.divIcon({
    className: pinClassName(state),
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -36],
    html: renderPinSvg({
      kind: 'pickup',
      sequence,
      vehicleCount,
      failed,
      state,
    }),
  })
}
