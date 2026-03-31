import L from 'leaflet'
import type { FleetUnit } from './types'
import { STATUS_COLORS } from './utils'

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.684-.949V8a1 1 0 0 1 1-1h1.382a1 1 0 0 1 .894.553l1.448 2.894A1 1 0 0 0 19.882 11H21a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`

const PERSON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`

/**
 * Layout: 36×48 container
 *   - Top 10px: heading arrow (rotated independently)
 *   - Middle 32px: status-colored circle with icon (always upright)
 *   - Bottom 6px: speed badge
 */
export function createFleetIcon(unit: FleetUnit): L.DivIcon {
  const color = STATUS_COLORS[unit.status]
  const svg = unit.type === 'vehicle' ? TRUCK_SVG : PERSON_SVG

  // Arrow — only rotates by heading, positioned in top zone
  const arrow =
    unit.heading != null && unit.status !== 'offline'
      ? `<div style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(${unit.heading}deg);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:8px solid ${color};"></div>`
      : ''

  // Speed badge — positioned in bottom zone, inside container bounds
  const speedBadge =
    unit.status !== 'offline'
      ? `<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);background:${color};color:#fff;font-size:9px;font-weight:600;padding:0 4px;border-radius:6px;white-space:nowrap;line-height:14px;">${Math.round(unit.speed)}</div>`
      : ''

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:36px;height:48px;">
      ${arrow}
      <div style="position:absolute;top:8px;left:2px;display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${color};border:2.5px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25);">
        ${svg}
      </div>
      ${speedBadge}
    </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 28],
    popupAnchor: [0, -28],
  })
}

export function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  let size = 40
  let fontSize = 13
  if (count >= 100) {
    size = 56
    fontSize = 15
  } else if (count >= 10) {
    size = 48
    fontSize = 14
  }

  return L.divIcon({
    className: 'fleet-cluster-icon',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:rgba(255,255,255,0.85);backdrop-filter:blur(8px);border:2px solid rgba(0,0,0,0.1);border-radius:50%;box-shadow:0 2px 12px rgba(0,0,0,.15);font-size:${fontSize}px;font-weight:700;color:#1e293b;">
      ${count}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
