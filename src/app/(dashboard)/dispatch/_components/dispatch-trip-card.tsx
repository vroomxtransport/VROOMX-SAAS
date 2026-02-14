'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/shared/status-badge'
import { TRUCK_CAPACITY } from '@/types'
import type { TripStatus } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

interface DispatchTripCardProps {
  trip: TripWithRelations
}

const CARD_BORDER_COLORS: Record<TripStatus, string> = {
  planned: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  at_terminal: 'border-l-purple-500',
  completed: 'border-l-green-500',
}

function formatDriverName(driver: TripWithRelations['driver']): string {
  if (!driver) return 'Unassigned'
  const lastInitial = driver.last_name ? driver.last_name.charAt(0) + '.' : ''
  return `${driver.first_name} ${lastInitial}`
}

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
  } catch {
    return `${startDate} - ${endDate}`
  }
}

export function DispatchTripCard({ trip }: DispatchTripCardProps) {
  const router = useRouter()
  const truckUnit = trip.truck?.unit_number ?? 'N/A'
  const driverName = formatDriverName(trip.driver)
  const truckType = trip.truck?.truck_type
  const maxCapacity = truckType ? TRUCK_CAPACITY[truckType] : 0
  const orderCount = trip.order_count ?? 0
  const capacityPercent = maxCapacity > 0 ? (orderCount / maxCapacity) * 100 : 0
  const dateRange = formatDateRange(trip.start_date, trip.end_date)

  const origin = trip.origin_summary
  const destination = trip.destination_summary
  const routeText = origin && destination
    ? `${origin} \u2192 ${destination}`
    : origin
      ? `${origin} \u2192 ...`
      : destination
        ? `... \u2192 ${destination}`
        : 'No route'

  return (
    <div
      onClick={() => router.push(`/trips/${trip.id}`)}
      className={cn(
        'rounded-lg border border-border-subtle bg-surface p-3 cursor-pointer card-hover hover:border-brand/30 border-l-[3px]',
        CARD_BORDER_COLORS[trip.status as TripStatus]
      )}
    >
      {/* Top: Trip number + status */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {trip.trip_number ?? 'N/A'}
        </span>
        <StatusBadge status={trip.status} type="trip" className="text-[10px] px-1.5 py-0" />
      </div>

      {/* Truck | Driver */}
      <div className="mt-1.5 text-xs text-muted-foreground">
        {truckUnit} | {driverName}
      </div>

      {/* Route */}
      <div className="mt-1 text-xs text-muted-foreground truncate" title={routeText}>
        {routeText}
      </div>

      {/* Capacity bar + date */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                capacityPercent >= 100 ? 'bg-red-500' : capacityPercent >= 75 ? 'bg-amber-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {orderCount}/{maxCapacity || '?'}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {dateRange}
        </span>
      </div>
    </div>
  )
}
