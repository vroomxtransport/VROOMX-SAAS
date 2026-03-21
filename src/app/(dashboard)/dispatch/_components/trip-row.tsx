'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { StatusBadge } from '@/components/shared/status-badge'
import { TRUCK_CAPACITY } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

interface TripRowProps {
  trip: TripWithRelations
  isDraggingOrder?: boolean
  activeId?: string | null
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

export function TripRow({ trip, isDraggingOrder, activeId }: TripRowProps) {
  const router = useRouter()

  const truckUnit = trip.truck?.unit_number ?? 'N/A'
  const driverName = formatDriverName(trip.driver)
  const truckType = trip.truck?.truck_type
  const maxCapacity = truckType ? TRUCK_CAPACITY[truckType] : 0
  const orderCount = trip.order_count ?? 0
  const isAtCapacity = maxCapacity > 0 && orderCount >= maxCapacity
  const capacityColor = maxCapacity > 0 ? getCapacityColor(orderCount, maxCapacity) : 'text-muted-foreground'
  const capacityText = maxCapacity > 0 ? `${orderCount}/${maxCapacity}` : `${orderCount}`
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const route = formatRouteSummary(trip.origin_summary, trip.destination_summary)

  // Draggable: move trip between status sections
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: trip.id,
    data: { type: 'trip', trip },
  })

  // Droppable: receive orders (only when an order is being dragged)
  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: `trip-drop-${trip.id}`,
    data: { type: 'trip-card', tripId: trip.id },
    disabled: !isDraggingOrder,
  })

  // Combine refs
  const setRefs = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  const isBeingDragged = isDragging || activeId === trip.id

  return (
    <div
      ref={setRefs}
      onClick={() => {
        if (isDragging) return
        router.push(`/trips/${trip.id}`)
      }}
      className={cn(
        'group relative flex items-center gap-4 rounded-lg border border-border bg-surface px-3 py-2.5 transition-all duration-150 cursor-pointer hover:bg-muted/50',
        isBeingDragged && 'opacity-40 scale-[0.98]',
        isDraggingOrder && !isOver && 'ring-1 ring-dashed ring-brand/20',
        isOver && !isAtCapacity && 'ring-2 ring-green-500/60 bg-green-950/10',
        isOver && isAtCapacity && 'ring-2 ring-amber-500/60 bg-amber-950/10',
      )}
    >
      {/* Drag handle */}
      <button
        className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-8 w-5 rounded-sm opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Drop indicator for order */}
      {isOver && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            !isAtCapacity ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
          )}>
            {!isAtCapacity ? 'Drop to Assign' : 'At Capacity'}
          </span>
        </div>
      )}

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
    </div>
  )
}
