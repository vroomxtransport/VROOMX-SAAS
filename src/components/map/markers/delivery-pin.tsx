'use client'

import L from 'leaflet'
import { renderPinSvg, pinClassName } from './pin-svg'
import type { MarkerState } from './marker-tokens'

interface CreateDeliveryIconArgs {
  sequence: number
  vehicleCount?: number
  failed?: boolean
  state?: MarkerState
}

/**
 * Build a Leaflet `DivIcon` for a delivery stop. Orange shield body,
 * darker orange stroke, white badge with orange sequence number, ■
 * glyph. Sibling of `createPickupIcon`.
 */
export function createDeliveryIcon({
  sequence,
  vehicleCount,
  failed,
  state = 'default',
}: CreateDeliveryIconArgs): L.DivIcon {
  return L.divIcon({
    className: pinClassName(state),
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    popupAnchor: [0, -36],
    html: renderPinSvg({
      kind: 'delivery',
      sequence,
      vehicleCount,
      failed,
      state,
    }),
  })
}
