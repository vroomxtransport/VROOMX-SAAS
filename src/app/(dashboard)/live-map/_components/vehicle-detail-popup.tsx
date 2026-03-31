'use client'

import { ExternalLink, Navigation, Gauge, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { FleetUnit } from '../_lib/types'
import { STATUS_COLORS, headingToCompass, relativeTime } from '../_lib/utils'
import Link from 'next/link'

interface VehicleDetailPopupProps {
  unit: FleetUnit
}

const STATUS_LABELS: Record<string, string> = {
  moving: 'Moving',
  idle: 'Idle',
  offline: 'Offline',
}

export function VehicleDetailPopup({ unit }: VehicleDetailPopupProps) {
  const compass = headingToCompass(unit.heading)
  const color = STATUS_COLORS[unit.status]

  return (
    <div className="glass-card w-64 rounded-xl p-3 shadow-lg">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{unit.name}</h3>
          {unit.subtitle && (
            <p className="text-xs text-muted-foreground">{unit.subtitle}</p>
          )}
        </div>
        <Badge
          variant="secondary"
          className="text-[10px] font-semibold"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {STATUS_LABELS[unit.status]}
        </Badge>
      </div>

      {/* Stats */}
      <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Gauge className="h-3 w-3" />
          <span className="font-medium text-foreground">{Math.round(unit.speed)} mph</span>
        </div>
        {compass && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Navigation className="h-3 w-3" style={{ transform: `rotate(${unit.heading}deg)` }} />
            <span className="font-medium text-foreground">{compass}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{relativeTime(unit.lastUpdate)}</span>
        </div>
      </div>

      {/* Coordinates */}
      <p className="mb-2 text-[10px] text-muted-foreground">
        {unit.latitude.toFixed(5)}, {unit.longitude.toFixed(5)}
      </p>

      {/* Link */}
      {unit.linkHref && (
        <Link
          href={unit.linkHref}
          className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
        >
          View Details
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
