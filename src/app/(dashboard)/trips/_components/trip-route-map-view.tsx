'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Popup, Marker, useMap } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import type { Order, RouteStop } from '@/types/database'
import { createPickupIcon } from '@/components/map/markers/pickup-pin'
import { createDeliveryIcon } from '@/components/map/markers/delivery-pin'
import { RoutePolyline } from '@/components/map/route-polyline'
import { RoutePopup } from '@/components/map/route-popup'
import { MapChrome } from '@/components/map/map-chrome'

interface StopWithCoords {
  orderId: string
  stopType: 'pickup' | 'delivery'
  lat: number
  lng: number
  orderNumber: string | null
  addressLine1: string | null
  addressLine2: string | null
  vehicleDescription: string
  index: number
}

function buildDefaultSequence(orders: Order[]): RouteStop[] {
  const pickups = [...orders]
    .sort((a, b) => (a.pickup_date ?? '').localeCompare(b.pickup_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'pickup' as const }))
  const deliveries = [...orders]
    .sort((a, b) => (a.delivery_date ?? '').localeCompare(b.delivery_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'delivery' as const }))
  return [...pickups, ...deliveries]
}

function vehicleString(order: Order): string {
  const parts = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean)
  return parts.join(' ') || 'Vehicle'
}

interface TripRouteMapViewProps {
  orders: Order[]
  sequence: RouteStop[] | null
  /** Cached Mapbox driving polyline for the FULL trip in sequence order.
   *  When present, replaces both the per-order polylines and the dashed
   *  sequence connector. */
  tripRouteGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null
}

const MAPBOX_LIGHT_TILE_URL =
  'https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token={accessToken}'
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

export function TripRouteMapView({ orders, sequence, tripRouteGeometry }: TripRouteMapViewProps) {
  const orderMap = useMemo(() => {
    const m = new Map<string, Order>()
    for (const o of orders) m.set(o.id, o)
    return m
  }, [orders])

  const activeSequence = useMemo(
    () => (sequence && sequence.length > 0 ? sequence : buildDefaultSequence(orders)),
    [sequence, orders],
  )

  const stops: StopWithCoords[] = useMemo(() => {
    const result: StopWithCoords[] = []
    activeSequence.forEach((stop, index) => {
      const order = orderMap.get(stop.orderId)
      if (!order) return
      const isPickup = stop.stopType === 'pickup'
      const lat = isPickup ? order.pickup_latitude : order.delivery_latitude
      const lng = isPickup ? order.pickup_longitude : order.delivery_longitude
      if (lat == null || lng == null) return

      const city = isPickup ? order.pickup_city : order.delivery_city
      const state = isPickup ? order.pickup_state : order.delivery_state
      const zip = isPickup ? order.pickup_zip : order.delivery_zip
      const location = isPickup ? order.pickup_location : order.delivery_location

      result.push({
        orderId: order.id,
        stopType: stop.stopType,
        lat,
        lng,
        orderNumber: order.order_number,
        addressLine1: location ?? null,
        addressLine2:
          [city, state].filter(Boolean).join(', ') +
          (zip ? ` ${zip}` : ''),
        vehicleDescription: vehicleString(order),
        index: index + 1,
      })
    })
    return result
  }, [activeSequence, orderMap])

  // Cached per-order driving polylines from `orders.route_geometry`.
  // Mapbox returns [lon, lat]; Leaflet wants [lat, lng] — flip here.
  const orderRoutePolylines = useMemo(() => {
    const lines: Array<{ orderId: string; positions: [number, number][] }> = []
    for (const order of orders) {
      const geom = order.route_geometry
      if (
        !geom ||
        geom.type !== 'LineString' ||
        !Array.isArray(geom.coordinates) ||
        geom.coordinates.length < 2
      ) continue
      lines.push({
        orderId: order.id,
        positions: geom.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      })
    }
    return lines
  }, [orders])

  const sequenceLine = useMemo(
    () => stops.map((s) => [s.lat, s.lng] as [number, number]),
    [stops],
  )

  const fitBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (stops.length === 0) return null
    return L.latLngBounds(stops.map((s) => [s.lat, s.lng]))
  }, [stops])

  // Stop → sibling vehicles at the same address+kind. A pickup at
  // the same yard for 3 orders becomes one marker with a `×3` badge.
  // Two-pass O(n): first group stops by (kind|lat|lng), then derive
  // per-stop meta from the group lookup. Avoids the O(n²) self-filter
  // pattern + per-stop spread that React 19's hooks lint disallows.
  const vehiclesByStop = useMemo(() => {
    type StopMeta = {
      count: number
      vehicles: { orderNumber: string | null; description: string }[]
    }
    const groups: Record<string, StopWithCoords[]> = {}
    for (const stop of stops) {
      const key = `${stop.stopType}|${stop.lat}|${stop.lng}`
      const existing = groups[key]
      groups[key] = existing ? [...existing, stop] : [stop]
    }
    return Object.fromEntries(
      stops.map((stop): [string, StopMeta] => {
        const siblings = groups[`${stop.stopType}|${stop.lat}|${stop.lng}`] ?? [stop]
        return [
          `${stop.orderId}-${stop.stopType}`,
          {
            count: siblings.length,
            vehicles: siblings.map((s) => ({
              orderNumber: s.orderNumber,
              description: s.vehicleDescription,
            })),
          },
        ]
      }),
    )
  }, [stops])

  // Stable per-stop icons. Memoizing per-render against the stops
  // array means realtime ticks (which can recreate the orders array
  // reference even when its contents are equivalent) don't churn the
  // marker DivIcons. Within the same render, dedupe by (kind,
  // sequence, vehicleCount) so duplicate stops share one icon ref.
  const stopIcons = useMemo(() => {
    const dedupe: Record<string, L.DivIcon> = {}
    return stops.map((stop) => {
      const meta = vehiclesByStop[`${stop.orderId}-${stop.stopType}`]
      const vehicleCount = meta?.count ?? 1
      const key = `${stop.stopType}|${stop.index}|${vehicleCount}`
      const cached = dedupe[key]
      if (cached) return cached
      const icon = stop.stopType === 'pickup'
        ? createPickupIcon({ sequence: stop.index, vehicleCount })
        : createDeliveryIcon({ sequence: stop.index, vehicleCount })
      dedupe[key] = icon
      return icon
    })
  }, [stops, vehiclesByStop])

  const useMapboxTiles = Boolean(process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN)
  const tileUrl = useMapboxTiles
    ? MAPBOX_LIGHT_TILE_URL.replace(
        '{accessToken}',
        process.env.NEXT_PUBLIC_MAPBOX_PUBLIC_TOKEN as string,
      )
    : OSM_TILE_URL
  const attribution = useMapboxTiles ? MAPBOX_ATTRIBUTION : OSM_ATTRIBUTION

  if (stops.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No geocoded orders to display on map
      </div>
    )
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      zoomControl={false}
      attributionControl={false}
      className="vroomx-map h-full w-full rounded-lg"
    >
      <TileLayer
        url={tileUrl}
        attribution={attribution}
        tileSize={256}
        zoomOffset={0}
      />

      <FitBoundsOnMount bounds={fitBounds} />
      <MapChrome fitBounds={fitBounds} attribution={useMapboxTiles ? '© Mapbox · © OpenStreetMap' : '© OpenStreetMap'} />

      {tripRouteGeometry &&
      tripRouteGeometry.type === 'LineString' &&
      Array.isArray(tripRouteGeometry.coordinates) &&
      tripRouteGeometry.coordinates.length >= 2 ? (
        // Single trip-level cached driving polyline — navy + white
        // casing halo. Mapbox stores coords as [lon, lat]; Leaflet
        // expects [lat, lng]. Replaces per-order + sequence renders.
        <RoutePolyline
          mode="driving"
          positions={tripRouteGeometry.coordinates.map(
            ([lon, lat]) => [lat, lon] as [number, number],
          )}
        />
      ) : (
        <>
          {/* Legacy fallback: per-order driving polylines + dashed
              sequence connector. Renders when `trip.route_geometry`
              hasn't been cached yet (legacy trip, not-yet-saved
              sequence, or Mapbox failure). */}
          <RoutePolyline positions={sequenceLine} mode="sequence" />
          {orderRoutePolylines.map((line) => (
            <RoutePolyline key={`route-${line.orderId}`} positions={line.positions} mode="driving" />
          ))}
        </>
      )}

      {stops.map((stop, idx) => {
        const meta = vehiclesByStop[`${stop.orderId}-${stop.stopType}`]
        return (
          <Marker
            key={`${stop.orderId}-${stop.stopType}`}
            position={[stop.lat, stop.lng]}
            icon={stopIcons[idx]}
          >
            <Popup className="vroomx-map-popup" closeButton={false} maxWidth={280} minWidth={280}>
              <RoutePopup
                kind={stop.stopType}
                sequence={stop.index}
                addressLine1={stop.addressLine1}
                addressLine2={stop.addressLine2}
                vehicles={meta?.vehicles ?? [{ orderNumber: stop.orderNumber, description: stop.vehicleDescription }]}
                primaryOrderId={stop.orderId}
                latitude={stop.lat}
                longitude={stop.lng}
              />
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

function FitBoundsOnMount({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap()
  useEffect(() => {
    if (!bounds) return
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
  }, [map, bounds])
  return null
}

export { buildDefaultSequence }
