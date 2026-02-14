'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useDriverLocations } from '@/hooks/use-driver-locations'
import { DriverPanel } from './driver-panel'
import { useCallback, useState } from 'react'
import type { DriverLocation } from '@/types/database'

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

function FlyToDriver({ location }: { location: DriverLocation | null }) {
  const map = useMap()

  if (location) {
    map.flyTo([location.latitude, location.longitude], 12, { duration: 1 })
  }

  return null
}

export function MapView() {
  const { data: locations = [], isLoading } = useDriverLocations()
  const [selectedLocation, setSelectedLocation] =
    useState<DriverLocation | null>(null)

  const handleSelectDriver = useCallback((loc: DriverLocation) => {
    setSelectedLocation(loc)
    // Reset after fly animation so subsequent clicks on same driver still work
    setTimeout(() => setSelectedLocation(null), 1500)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <p className="text-muted-foreground">Loading driver locations...</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Side panel */}
      <div className="w-80 shrink-0 overflow-y-auto border-r border-border-subtle bg-background">
        <DriverPanel
          locations={locations}
          onSelectDriver={handleSelectDriver}
        />
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FlyToDriver location={selectedLocation} />

          {locations.map((loc) => {
            const driverName = loc.driver
              ? `${loc.driver.first_name} ${loc.driver.last_name}`
              : 'Unknown Driver'

            return (
              <Marker
                key={loc.id}
                position={[loc.latitude, loc.longitude]}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{driverName}</p>
                    {loc.speed != null && (
                      <p className="text-muted-foreground">
                        {Math.round(loc.speed)} mph
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Last updated:{' '}
                      {new Date(loc.updated_at).toLocaleTimeString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
