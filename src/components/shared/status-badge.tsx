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
  DRIVER_APPLICATION_STATUS_COLORS,
  DRIVER_APPLICATION_STATUS_LABELS,
  ONBOARDING_STEP_STATUS_COLORS,
  ONBOARDING_STEP_STATUS_LABELS,
} from '@/types'
import type { OrderStatus, DriverStatus, TruckStatus, TripStatus, TrailerStatus } from '@/types'
import { cn } from '@/lib/utils'

type StatusBadgeType = 'order' | 'driver' | 'truck' | 'trip' | 'trailer' | 'application' | 'onboarding_step'

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
  application: {
    colors: DRIVER_APPLICATION_STATUS_COLORS as Record<string, string>,
    labels: DRIVER_APPLICATION_STATUS_LABELS as Record<string, string>,
    dotColors: {
      draft: 'bg-gray-400',
      submitted: 'bg-blue-400',
      in_review: 'bg-amber-400',
      pending_adverse_action: 'bg-orange-400',
      approved: 'bg-green-500',
      rejected: 'bg-red-400',
      withdrawn: 'bg-gray-300',
    },
  },
  onboarding_step: {
    colors: ONBOARDING_STEP_STATUS_COLORS as Record<string, string>,
    labels: ONBOARDING_STEP_STATUS_LABELS as Record<string, string>,
    dotColors: {
      pending: 'bg-gray-400',
      in_progress: 'bg-blue-400',
      passed: 'bg-green-500',
      failed: 'bg-red-400',
      waived: 'bg-purple-400',
      not_applicable: 'bg-gray-300',
    },
  },
}

const FALLBACK_COLORS = 'text-gray-700'
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
