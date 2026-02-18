'use client'

import dynamic from 'next/dynamic'
import type { Order, RouteStop } from '@/types/database'

const TripRouteMapView = dynamic(
  () => import('./trip-route-map-view').then((m) => ({ default: m.TripRouteMapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-lg border bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
)

interface TripRouteMapContainerProps {
  orders: Order[]
  sequence: RouteStop[] | null
}

export function TripRouteMapContainer({ orders, sequence }: TripRouteMapContainerProps) {
  return (
    <div className="h-[400px] overflow-hidden rounded-lg border">
      <TripRouteMapView orders={orders} sequence={sequence} />
    </div>
  )
}
