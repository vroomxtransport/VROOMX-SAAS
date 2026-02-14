'use client'

import dynamic from 'next/dynamic'

const MapView = dynamic(
  () => import('./map-view').then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    ),
  }
)

export function MapContainer() {
  return <MapView />
}
