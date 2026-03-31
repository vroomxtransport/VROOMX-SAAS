'use client'

import { Search, Layers, Info, Maximize2, Minimize2, Map } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { FleetFilters, MapStyle } from '../_lib/types'
import { MAP_STYLES } from '../_lib/types'
import { useRef, useCallback } from 'react'

interface MapToolbarProps {
  filters: FleetFilters
  onFiltersChange: (filters: FleetFilters) => void
  mapStyle: MapStyle
  onMapStyleChange: (style: MapStyle) => void
  clusterEnabled: boolean
  onClusterToggle: () => void
  legendVisible: boolean
  onLegendToggle: () => void
  isFullscreen: boolean
  onFullscreenToggle: () => void
  panelCollapsed: boolean
}

export function MapToolbar({
  filters,
  onFiltersChange,
  mapStyle,
  onMapStyleChange,
  clusterEnabled,
  onClusterToggle,
  legendVisible,
  onLegendToggle,
  isFullscreen,
  onFullscreenToggle,
  panelCollapsed,
}: MapToolbarProps) {
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value })
      }, 300)
    },
    [filters, onFiltersChange]
  )

  const leftOffset = panelCollapsed
    ? 'left-[calc(theme(spacing.12)+0.75rem)]'
    : 'left-[calc(theme(spacing.80)+0.75rem)]'

  return (
    <div
      className={`pointer-events-none absolute top-3 right-3 z-[1000] ${leftOffset} transition-all duration-300`}
    >
      <div className="pointer-events-auto glass-panel flex items-center gap-2 rounded-xl px-3 py-2">
        {/* Search */}
        <div className="relative min-w-[160px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search fleet..."
            defaultValue={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>

        {/* Type filter */}
        <Select
          value={filters.type}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, type: v as FleetFilters['type'] })
          }
        >
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vehicle">Trucks</SelectItem>
            <SelectItem value="driver">Drivers</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={filters.status}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, status: v as FleetFilters['status'] })
          }
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="moving">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Moving
              </span>
            </SelectItem>
            <SelectItem value="idle">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Idle
              </span>
            </SelectItem>
            <SelectItem value="offline">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Offline
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Map style */}
        <Select
          value={mapStyle}
          onValueChange={(v) => onMapStyleChange(v as MapStyle)}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <Map className="mr-1 h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {MAP_STYLES.map((style) => (
              <SelectItem key={style.key} value={style.key}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-5" />

        {/* Cluster toggle */}
        <Button
          variant={clusterEnabled ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={onClusterToggle}
          title="Toggle clustering"
        >
          <Layers className="h-3.5 w-3.5" />
        </Button>

        {/* Legend toggle */}
        <Button
          variant={legendVisible ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={onLegendToggle}
          title="Toggle legend"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>

        {/* Fullscreen toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onFullscreenToggle}
          title="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
