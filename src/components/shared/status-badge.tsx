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
} from '@/types'
import type { OrderStatus, DriverStatus, TruckStatus, TripStatus } from '@/types'
import { cn } from '@/lib/utils'

type StatusBadgeType = 'order' | 'driver' | 'truck' | 'trip'

interface StatusBadgeProps {
  status: string
  type: StatusBadgeType
  className?: string
}

function getColorClasses(status: string, type: StatusBadgeType): string {
  switch (type) {
    case 'order':
      return ORDER_STATUS_COLORS[status as OrderStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200'
    case 'driver':
      return DRIVER_STATUS_COLORS[status as DriverStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200'
    case 'truck':
      return TRUCK_STATUS_COLORS[status as TruckStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200'
    case 'trip':
      return TRIP_STATUS_COLORS[status as TripStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function getLabel(status: string, type: StatusBadgeType): string {
  switch (type) {
    case 'order':
      return ORDER_STATUS_LABELS[status as OrderStatus] ?? status
    case 'driver':
      return DRIVER_STATUS_LABELS[status as DriverStatus] ?? status
    case 'truck':
      return TRUCK_STATUS_LABELS[status as TruckStatus] ?? status
    case 'trip':
      return TRIP_STATUS_LABELS[status as TripStatus] ?? status
    default:
      return status
  }
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(getColorClasses(status, type), className)}
    >
      {getLabel(status, type)}
    </Badge>
  )
}
