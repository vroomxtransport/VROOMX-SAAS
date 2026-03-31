'use client'

import type { FleetStats } from '../_lib/types'

interface MapLegendProps {
  stats: FleetStats
}

const LEGEND_ITEMS = [
  { label: 'Moving', color: '#059669', key: 'moving' as const },
  { label: 'Idle', color: '#d97706', key: 'idle' as const },
  { label: 'Offline', color: '#6b7280', key: 'offline' as const },
]

export function MapLegend({ stats }: MapLegendProps) {
  return (
    <div className="pointer-events-none absolute bottom-20 right-3 z-[1000] animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="pointer-events-auto glass-panel w-44 rounded-xl p-3">
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Legend
        </h4>
        <div className="space-y-1.5">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground">{item.label}</span>
              </div>
              <span className="font-medium text-muted-foreground">{stats[item.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
