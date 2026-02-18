'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Popup, useMap, Marker } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import type { Order, RouteStop } from '@/types/database'

// Fix default marker icon for Next.js/webpack compatibility
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function createNumberedIcon(number: number, type: 'pickup' | 'delivery'): L.DivIcon {
  const bg = type === 'pickup' ? '#16a34a' : '#dc2626'
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      border:2px solid #fff;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);
    ">${number}</div>`,
  })
}

interface StopWithCoords {
  orderId: string
  stopType: 'pickup' | 'delivery'
  lat: number
  lng: number
  orderNumber: string | null
  address: string
  index: number
}

function buildDefaultSequence(orders: Order[]): RouteStop[] {
  // All pickups first (sorted by pickup_date), then all deliveries (sorted by delivery_date)
  const pickups = [...orders]
    .sort((a, b) => (a.pickup_date ?? '').localeCompare(b.pickup_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'pickup' as const }))

  const deliveries = [...orders]
    .sort((a, b) => (a.delivery_date ?? '').localeCompare(b.delivery_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'delivery' as const }))

  return [...pickups, ...deliveries]
}

function FitBounds({ stops }: { stops: StopWithCoords[] }) {
  const map = useMap()

  useEffect(() => {
    if (stops.length === 0) return
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
  }, [map, stops])

  return null
}

interface TripRouteMapViewProps {
  orders: Order[]
  sequence: RouteStop[] | null
}

export function TripRouteMapView({ orders, sequence }: TripRouteMapViewProps) {
  const orderMap = useMemo(() => {
    const m = new Map<string, Order>()
    for (const o of orders) m.set(o.id, o)
    return m
  }, [orders])

  const activeSequence = useMemo(
    () => (sequence && sequence.length > 0 ? sequence : buildDefaultSequence(orders)),
    [sequence, orders]
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
      const location = isPickup ? order.pickup_location : order.delivery_location

      result.push({
        orderId: order.id,
        stopType: stop.stopType,
        lat,
        lng,
        orderNumber: order.order_number,
        address: location || [city, state].filter(Boolean).join(', ') || 'Unknown',
        index: index + 1,
      })
    })
    return result
  }, [activeSequence, orderMap])

  const polylinePositions = useMemo(
    () => stops.map((s) => [s.lat, s.lng] as [number, number]),
    [stops]
  )

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
      className="h-full w-full rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds stops={stops} />

      {polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#6366f1',
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.7,
          }}
        />
      )}

      {stops.map((stop) => (
        <Marker
          key={`${stop.orderId}-${stop.stopType}`}
          position={[stop.lat, stop.lng]}
          icon={createNumberedIcon(stop.index, stop.stopType)}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">
                Stop #{stop.index} — {stop.stopType === 'pickup' ? 'Pickup' : 'Delivery'}
              </p>
              <p className="text-muted-foreground">
                {stop.orderNumber ?? 'Draft'} — {stop.address}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export { buildDefaultSequence }
