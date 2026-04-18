'use client'

import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { MARKER_TOKENS } from './markers/marker-tokens'

interface VehicleSummary {
  orderNumber: string | null
  description: string
}

interface RoutePopupProps {
  kind: 'pickup' | 'delivery'
  sequence: number
  /** Street address line, e.g. `1420 Industrial Pkwy`. */
  addressLine1: string | null
  /** City, state ZIP line, e.g. `Dallas, TX 75201`. */
  addressLine2: string | null
  vehicles: VehicleSummary[]
  /** First order ID — the "Open order" link target. Single-vehicle stops point here. */
  primaryOrderId: string
  /** Lat/lng for the Get Directions link. */
  latitude: number
  longitude: number
}

const KIND_LABEL: Record<RoutePopupProps['kind'], string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
}

/**
 * Marker popup body. Rendered inside a `react-leaflet` `<Popup>` with
 * `className='vroomx-map-popup'` — the Leaflet wrapper, tail, and
 * shadow are stripped in `globals.css` so this card reads as a flat
 * sticker, no tail.
 *
 * Layout is fixed-width 280px (set via the parent wrapper CSS) and
 * keeps to ~3 vehicle rows visible before scrolling. Action buttons
 * are ghost-style — primary is "Open order" (in-app), secondary is
 * "Get directions" (external Google Maps).
 */
export function RoutePopup({
  kind,
  sequence,
  addressLine1,
  addressLine2,
  vehicles,
  primaryOrderId,
  latitude,
  longitude,
}: RoutePopupProps) {
  const tokens = MARKER_TOKENS[kind]
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
  const vehicleCount = vehicles.length
  const subtitle =
    vehicleCount === 1
      ? '1 vehicle'
      : `${vehicleCount} vehicles`

  return (
    <div className="vroomx-map-popup__card">
      <header className="vroomx-map-popup__header">
        <span
          className="vroomx-map-popup__seq"
          style={{
            background: tokens.badgeBg,
            color: tokens.badgeText,
            border: `1px solid ${tokens.stroke}`,
          }}
        >
          {String(sequence).padStart(2, '0')}
        </span>
        <div className="vroomx-map-popup__heading">
          <span className="vroomx-map-popup__kind">{KIND_LABEL[kind]}</span>
          <span className="vroomx-map-popup__sub">· {subtitle}</span>
        </div>
      </header>

      <div className="vroomx-map-popup__address">
        {addressLine1 && (
          <p className="vroomx-map-popup__line1">{addressLine1}</p>
        )}
        {addressLine2 && (
          <p className="vroomx-map-popup__line2">{addressLine2}</p>
        )}
      </div>

      {vehicles.length > 0 && (
        <ul className="vroomx-map-popup__vehicles">
          {vehicles.slice(0, 3).map((v, i) => (
            <li key={`${v.orderNumber ?? 'order'}-${i}`}>
              {v.orderNumber ? (
                <span className="vroomx-map-popup__order">#{v.orderNumber}</span>
              ) : null}
              <span className="vroomx-map-popup__vehicle">{v.description}</span>
            </li>
          ))}
          {vehicles.length > 3 && (
            <li className="vroomx-map-popup__more">+{vehicles.length - 3} more</li>
          )}
        </ul>
      )}

      <footer className="vroomx-map-popup__footer">
        {/* Plain <a> here, NOT next/link. Leaflet renders popups into a
         *  detached DOM subtree outside React's portal tree; next/link's
         *  prefetch fires on hover and the click can fall through to a
         *  full reload in some Leaflet/Next combos. Plain <a> is more
         *  predictable and avoids prefetching a route per pin hover. */}
        <a
          href={`/orders/${primaryOrderId}`}
          className="vroomx-map-popup__btn vroomx-map-popup__btn--primary"
        >
          Open order
          <ArrowUpRight className="h-3 w-3" />
        </a>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="vroomx-map-popup__btn"
        >
          Get directions
          <ExternalLink className="h-3 w-3" />
        </a>
      </footer>
    </div>
  )
}
