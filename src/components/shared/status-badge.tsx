'use client'

import { Badge } from '@/components/ui/badge'
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  DRIVER_STATUS_COLORS,
  DRIVER_STATUS_LABELS,
  TRUCK_STATUS_COLORS,
  TRUCK_STATUS_LABELS,
  TRIP_STATUS_COLORS,
  TRIP_STATUS_LABELS,
  TRAILER_STATUS_COLORS,
  TRAILER_STATUS_LABELS,
} from '@/types'
import type { OrderStatus, DriverStatus, TruckStatus, TripStatus, TrailerStatus } from '@/types'
import { cn } from '@/lib/utils'

type StatusBadgeType = 'order' | 'driver' | 'truck' | 'trip' | 'trailer'

interface StatusBadgeProps {
  status: string
  type: StatusBadgeType
  className?: string
  pulsing?: boolean
}

type StatusConfig = {
  colors: Record<string, string>
  labels: Record<string, string>
  dotColors: Record<string, string>
}

const STATUS_CONFIG: Record<StatusBadgeType, StatusConfig> = {
  order: {
    colors: ORDER_STATUS_COLORS as Record<string, string>,
    labels: ORDER_STATUS_LABELS as Record<string, string>,
    dotColors: {
      new: 'bg-blue-400',
      assigned: 'bg-amber-400',
      picked_up: 'bg-purple-400',
      delivered: 'bg-green-400',
      invoiced: 'bg-indigo-400',
      paid: 'bg-emerald-500',
      cancelled: 'bg-red-400',
    },
  },
  driver: {
    colors: DRIVER_STATUS_COLORS as Record<string, string>,
    labels: DRIVER_STATUS_LABELS as Record<string, string>,
    dotColors: {
      active: 'bg-green-400',
      inactive: 'bg-gray-400',
      on_trip: 'bg-blue-400',
    },
  },
  truck: {
    colors: TRUCK_STATUS_COLORS as Record<string, string>,
    labels: TRUCK_STATUS_LABELS as Record<string, string>,
    dotColors: {
      active: 'bg-green-400',
      inactive: 'bg-gray-400',
      maintenance: 'bg-amber-400',
      available: 'bg-green-400',
      in_use: 'bg-blue-400',
      retired: 'bg-gray-400',
    },
  },
  trip: {
    colors: TRIP_STATUS_COLORS as Record<string, string>,
    labels: TRIP_STATUS_LABELS as Record<string, string>,
    dotColors: {
      planned: 'bg-blue-400',
      in_progress: 'bg-amber-400',
      at_terminal: 'bg-purple-400',
      completed: 'bg-green-400',
    },
  },
  trailer: {
    colors: TRAILER_STATUS_COLORS as Record<string, string>,
    labels: TRAILER_STATUS_LABELS as Record<string, string>,
    dotColors: {
      active: 'bg-green-400',
      inactive: 'bg-gray-400',
      maintenance: 'bg-amber-400',
    },
  },
}

const FALLBACK_COLORS = 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700'
const FALLBACK_DOT = 'bg-gray-400'

export function StatusBadge({ status, type, className, pulsing }: StatusBadgeProps) {
  const config = STATUS_CONFIG[type]
  const colorClasses = config.colors[status] ?? FALLBACK_COLORS
  const dotColor = config.dotColors[status] ?? FALLBACK_DOT
  const label = config.labels[status] ?? status

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5', colorClasses, className)}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotColor)} />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotColor)} />
      </span>
      {label}
    </Badge>
  )
}
