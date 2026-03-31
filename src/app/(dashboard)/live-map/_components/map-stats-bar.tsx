'use client'

import { Activity, Pause, WifiOff, Gauge } from 'lucide-react'
import type { FleetStats } from '../_lib/types'

interface MapStatsBarProps {
  stats: FleetStats
}

export function MapStatsBar({ stats }: MapStatsBarProps) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000]">
      <div className="pointer-events-auto glass-panel flex items-center justify-center gap-6 rounded-xl px-4 py-2">
        <StatPill label="Total Tracked" value={stats.total} />
        <StatPill
          label="Moving"
          value={stats.moving}
          color="#059669"
          icon={<Activity className="h-3 w-3" />}
        />
        <StatPill
          label="Idle"
          value={stats.idle}
          color="#d97706"
          icon={<Pause className="h-3 w-3" />}
        />
        <StatPill
          label="Offline"
          value={stats.offline}
          color="#6b7280"
          icon={<WifiOff className="h-3 w-3" />}
        />
        <StatPill
          label="Avg Speed"
          value={`${Math.round(stats.avgSpeed)} mph`}
          icon={<Gauge className="h-3 w-3" />}
        />
      </div>
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number | string
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {!color && icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </div>
  )
}
