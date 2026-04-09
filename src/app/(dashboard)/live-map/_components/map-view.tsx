'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useFleetData } from '../_lib/use-fleet-data'
import type { FleetFilters, FleetUnit, MapStyle } from '../_lib/types'
import { DEFAULT_FILTERS, MAP_STYLES } from '../_lib/types'
import { FleetPanel } from './fleet-panel'
import { MarkerClusterGroup } from './marker-cluster-group'
import { MapToolbar } from './map-toolbar'
import { MapLegend } from './map-legend'
import { MapStatsBar } from './map-stats-bar'
import { useIsMobile } from '@/hooks/use-is-mobile'

// Mobile-only components — lazy-loaded, no SSR (already inside a dynamic boundary)
const MobileFleetSheet = dynamic(
  () =>
    import('./mobile-fleet-sheet').then((m) => ({ default: m.MobileFleetSheet })),
  { ssr: false },
)

const MobileMapToolbar = dynamic(
  () =>
    import('./mobile-map-toolbar').then((m) => ({ default: m.MobileMapToolbar })),
  { ssr: false },
)

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

interface FlyTarget {
  latitude: number
  longitude: number
}

function FlyToMarker({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.latitude, target.longitude], 12, { duration: 1 })
    }
  }, [map, target])
  return null
}

export function MapView() {
  const [filters, setFilters] = useState<FleetFilters>(DEFAULT_FILTERS)
  const [mapStyle, setMapStyle] = useState<MapStyle>('street')
  const [clusterEnabled, setClusterEnabled] = useState(true)
  const [legendVisible, setLegendVisible] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState<FleetUnit | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { units, stats, isLoading } = useFleetData(filters)
  const { isMobile } = useIsMobile()

  // Fly to selected unit
  const handleSelectUnit = useCallback((unit: FleetUnit) => {
    setSelectedUnit(unit)
    setFlyTarget({ latitude: unit.latitude, longitude: unit.longitude })
    setTimeout(() => setFlyTarget(null), 1500)
  }, [])

  // Fullscreen via browser API (desktop only)
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

  // Listen for Escape to exit fullscreen
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Mobile map height: viewport minus top header (3rem) minus bottom tab bar
  const mobileMapHeight = 'calc(100dvh - 3rem - var(--bottom-tab-height))'
  // Desktop map height
  const desktopMapHeight = 'calc(100vh - 3.5rem)'

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: isMobile ? mobileMapHeight : desktopMapHeight }}
      >
        <p className="text-muted-foreground">Loading fleet locations...</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex bg-background"
      style={{ height: isMobile ? mobileMapHeight : desktopMapHeight }}
    >
      {/* Desktop side panel — hidden on mobile */}
      {!isMobile && (
        <FleetPanel
          units={units}
          stats={stats}
          filters={filters}
          onFiltersChange={setFilters}
          selectedUnit={selectedUnit}
          onSelectUnit={handleSelectUnit}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((p) => !p)}
        />
      )}

      {/* Map area */}
      <div className="relative flex-1">
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          className="h-full w-full"
          style={{ zIndex: 0 }}
        >
          {MAP_STYLES.filter((s) => s.key === mapStyle).map((s) => (
            <TileLayer
              key={s.key}
              attribution={s.attribution}
              url={s.url}
            />
          ))}
          <FlyToMarker target={flyTarget} />
          <MarkerClusterGroup
            units={units}
            enabled={clusterEnabled}
            onSelectUnit={handleSelectUnit}
          />
        </MapContainer>

        {/* Desktop overlays */}
        {!isMobile && (
          <>
            <MapToolbar
              filters={filters}
              onFiltersChange={setFilters}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
              clusterEnabled={clusterEnabled}
              onClusterToggle={() => setClusterEnabled((e) => !e)}
              legendVisible={legendVisible}
              onLegendToggle={() => setLegendVisible((v) => !v)}
              isFullscreen={isFullscreen}
              onFullscreenToggle={handleFullscreenToggle}
              panelCollapsed={panelCollapsed}
            />
            {legendVisible && <MapLegend stats={stats} />}
            <MapStatsBar stats={stats} />
          </>
        )}

        {/* Mobile overlays */}
        {isMobile && (
          <>
            <MobileMapToolbar
              filters={filters}
              onFiltersChange={setFilters}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
              clusterEnabled={clusterEnabled}
              onClusterToggle={() => setClusterEnabled((e) => !e)}
              legendVisible={legendVisible}
              onLegendToggle={() => setLegendVisible((v) => !v)}
            />
            {legendVisible && <MapLegend stats={stats} />}
            <MobileFleetSheet
              units={units}
              stats={stats}
              filters={filters}
              onFiltersChange={setFilters}
              selectedUnit={selectedUnit}
              onSelectUnit={handleSelectUnit}
            />
          </>
        )}
      </div>
    </div>
  )
}
