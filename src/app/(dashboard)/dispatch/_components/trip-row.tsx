'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/shared/status-badge'
import { TRUCK_CAPACITY } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

interface TripRowProps {
  trip: TripWithRelations
}

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const startFormatted = format(start, 'MMM d')
    const endFormatted = format(end, 'MMM d')
    return `${startFormatted} - ${endFormatted}`
  } catch {
    return `${startDate} - ${endDate}`
  }
}

function formatDriverName(driver: TripWithRelations['driver']): string {
  if (!driver) return 'Unassigned'
  const lastInitial = driver.last_name ? driver.last_name.charAt(0) + '.' : ''
  return `${driver.first_name} ${lastInitial}`
}

function getCapacityColor(orderCount: number, maxCapacity: number): string {
  if (orderCount > maxCapacity) return 'text-red-600 font-semibold'
  if (orderCount === maxCapacity) return 'text-amber-600 font-semibold'
  return 'text-foreground/80'
}

function formatRouteSummary(
  origin: string | null,
  destination: string | null
): { text: string; muted: boolean } {
  if (origin && destination) {
    return { text: `${origin} \u2192 ${destination}`, muted: false }
  }
  if (origin) {
    return { text: `${origin} \u2192 ...`, muted: false }
  }
  if (destination) {
    return { text: `... \u2192 ${destination}`, muted: false }
  }
  return { text: 'No route', muted: true }
}

export function TripRow({ trip }: TripRowProps) {
  const truckUnit = trip.truck?.unit_number ?? 'N/A'
  const driverName = formatDriverName(trip.driver)
  const truckType = trip.truck?.truck_type
  const maxCapacity = truckType ? TRUCK_CAPACITY[truckType] : 0
  const orderCount = trip.order_count ?? 0
  const capacityColor = maxCapacity > 0 ? getCapacityColor(orderCount, maxCapacity) : 'text-muted-foreground'
  const capacityText = maxCapacity > 0 ? `${orderCount}/${maxCapacity}` : `${orderCount}`
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const route = formatRouteSummary(trip.origin_summary, trip.destination_summary)

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      {/* Trip # */}
      <div className="w-28 shrink-0">
        <span className="text-sm font-medium text-foreground">
          {trip.trip_number ?? 'N/A'}
        </span>
      </div>

      {/* Truck */}
      <div className="w-20 shrink-0">
        <span className="text-sm text-foreground/80">{truckUnit}</span>
      </div>

      {/* Driver */}
      <div className="w-24 shrink-0">
        <span className="text-sm text-foreground/80">{driverName}</span>
      </div>

      {/* Capacity */}
      <div className="w-14 shrink-0">
        <span className={cn('text-sm', capacityColor)}>{capacityText}</span>
      </div>

      {/* Route */}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            'truncate text-sm',
            route.muted ? 'text-muted-foreground/60 italic' : 'text-foreground/80'
          )}
        >
          {route.text}
        </span>
      </div>

      {/* Status */}
      <div className="w-28 shrink-0">
        <StatusBadge status={trip.status} type="trip" />
      </div>

      {/* Dates */}
      <div className="w-32 shrink-0 text-right">
        <span className="text-sm text-muted-foreground">{dateRange}</span>
      </div>
    </Link>
  )
}
