'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowRight, Calendar, Package } from 'lucide-react'
import { StatusBadge } from '@/components/shared/status-badge'
import { TRUCK_CAPACITY, TRIP_STATUS_COLORS } from '@/types'
import type { TripStatus, TruckType } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

interface MobileTripCardProps {
  trip: TripWithRelations
}

const STATUS_LEFT_BORDER: Record<TripStatus, string> = {
  planned: 'border-l-blue-400',
  in_progress: 'border-l-amber-400',
  at_terminal: 'border-l-purple-400',
  completed: 'border-l-green-400',
}

const STATUS_CAPACITY_BAR: Record<TripStatus, string> = {
  planned: 'bg-blue-400',
  in_progress: 'bg-amber-400',
  at_terminal: 'bg-purple-400',
  completed: 'bg-green-400',
}

function formatDriverName(driver: TripWithRelations['driver']): string {
  if (!driver) return 'Unassigned'
  const lastInitial = driver.last_name ? driver.last_name.charAt(0) + '.' : ''
  return `${driver.first_name} ${lastInitial}`
}

function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + 'T00:00:00'), 'MMM d')
  } catch {
    return dateStr
  }
}

export function MobileTripCard({ trip }: MobileTripCardProps) {
  const router = useRouter()

  const tripStatus = trip.status as TripStatus
  const truckUnit = trip.truck?.unit_number ?? 'No Truck'
  const driverName = formatDriverName(trip.driver)
  const truckType = trip.truck?.truck_type as TruckType | undefined
  const maxCapacity = truckType ? TRUCK_CAPACITY[truckType] : 0
  const orderCount = trip.order_count ?? 0
  const capacityPercent = maxCapacity > 0 ? Math.min((orderCount / maxCapacity) * 100, 100) : 0

  const origin = trip.origin_summary
  const destination = trip.destination_summary

  const startFormatted = formatDate(trip.start_date)
  const endFormatted = formatDate(trip.end_date)

  return (
    <button
      type="button"
      onClick={() => router.push(`/trips/${trip.id}`)}
      className={cn(
        'w-full text-left rounded-xl border border-border-subtle bg-surface',
        'border-l-[3px] p-4',
        'min-h-[44px]',
        'active:scale-[0.98] transition-transform duration-100',
        'hover:border-brand/30 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        STATUS_LEFT_BORDER[tripStatus],
      )}
      aria-label={`Trip ${trip.trip_number ?? 'N/A'} — ${driverName}`}
    >
      {/* Row 1: Trip number + status badge */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {trip.trip_number ?? 'N/A'}
        </span>
        <StatusBadge
          status={trip.status}
          type="trip"
          className="text-[10px] px-1.5 py-0 shrink-0"
        />
      </div>

      {/* Row 2: Truck + driver */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-foreground">{truckUnit}</span>
        <span className="text-xs text-muted-foreground/60">·</span>
        <span className="text-xs text-muted-foreground">{driverName}</span>
      </div>

      {/* Row 3: Route */}
      {(origin ?? destination) ? (
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          <span className="text-xs text-foreground/80 truncate max-w-[42%]">
            {origin ?? '…'}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          <span className="text-xs text-foreground/80 truncate max-w-[42%]">
            {destination ?? '…'}
          </span>
        </div>
      ) : (
        <div className="mb-2">
          <span className="text-xs italic text-muted-foreground">No route</span>
        </div>
      )}

      {/* Row 4: Dates + order count + capacity bar */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{startFormatted} – {endFormatted}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Package className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{orderCount}/{maxCapacity || '?'}</span>
          {maxCapacity > 0 && (
            <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  capacityPercent >= 100
                    ? 'bg-red-500'
                    : capacityPercent >= 75
                      ? 'bg-amber-500'
                      : STATUS_CAPACITY_BAR[tripStatus],
                )}
                style={{ width: `${Math.round(capacityPercent)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
