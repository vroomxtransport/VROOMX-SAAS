'use client'

import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import type { DriverLocation } from '@/types/database'

interface DriverPanelProps {
  locations: DriverLocation[]
  onSelectDriver?: (location: DriverLocation) => void
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function DriverPanel({ locations, onSelectDriver }: DriverPanelProps) {
  if (locations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <EmptyState
          icon={MapPin}
          title="No driver locations"
          description="Driver locations will appear here once drivers start sharing their position from the mobile app."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Active Drivers ({locations.length})
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {locations.map((loc) => {
          const driverName = loc.driver
            ? `${loc.driver.first_name} ${loc.driver.last_name}`
            : 'Unknown Driver'

          return (
            <button
              key={loc.id}
              type="button"
              className="w-full border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-accent"
              onClick={() => onSelectDriver?.(loc)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {driverName}
                </span>
                {loc.driver?.driver_status === 'active' && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                </span>
                {loc.speed != null && <span>{Math.round(loc.speed)} mph</span>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Updated {formatTime(loc.updated_at)}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
