'use client'

import type { TripWithRelations } from '@/lib/queries/trips'
import type { UnassignedOrderWithBroker } from '@/hooks/use-unassigned-orders'
import type { TripStatus } from '@/types'
import { TRUCK_CAPACITY } from '@/types'
import { cn } from '@/lib/utils'

const CARD_BORDER_COLORS: Record<TripStatus, string> = {
  planned: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  at_terminal: 'border-l-purple-500',
  completed: 'border-l-green-500',
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function TripDragOverlay({ trip }: { trip: TripWithRelations }) {
  const truckUnit = trip.truck?.unit_number ?? 'N/A'
  const driverName = trip.driver
    ? `${trip.driver.first_name} ${trip.driver.last_name?.charAt(0) ?? ''}.`
    : 'Unassigned'
  const truckType = trip.truck?.truck_type
  const maxCapacity = truckType ? TRUCK_CAPACITY[truckType] : 0
  const orderCount = trip.order_count ?? 0
  const route =
    trip.origin_summary && trip.destination_summary
      ? `${trip.origin_summary} → ${trip.destination_summary}`
      : 'No route'

  return (
    <div
      className={cn(
        'w-[300px] rounded-lg border border-border-subtle bg-surface p-3 border-l-[3px] shadow-xl ring-2 ring-brand/40 rotate-[2deg] pointer-events-none',
        CARD_BORDER_COLORS[trip.status as TripStatus]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {trip.trip_number ?? 'N/A'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {orderCount}/{maxCapacity || '?'}
        </span>
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {truckUnit} | {driverName}
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {route}
      </div>
    </div>
  )
}

export function OrderDragOverlay({ order }: { order: UnassignedOrderWithBroker }) {
  const vehicleName =
    [order.vehicle_year, order.vehicle_make, order.vehicle_model]
      .filter(Boolean)
      .join(' ') || 'Unknown Vehicle'

  const route =
    [
      order.pickup_city && order.pickup_state
        ? `${order.pickup_city}, ${order.pickup_state}`
        : null,
      order.delivery_city && order.delivery_state
        ? `${order.delivery_city}, ${order.delivery_state}`
        : null,
    ]
      .filter(Boolean)
      .join(' → ') || 'No route'

  return (
    <div className="w-[220px] rounded-lg border border-border-subtle bg-surface p-3 shadow-xl ring-2 ring-brand/40 rotate-[2deg] pointer-events-none">
      <div className="text-sm font-medium text-foreground truncate">
        {vehicleName}
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {route}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(order.revenue)}
        </span>
        <span className="text-xs text-muted-foreground">
          {order.order_number ?? 'N/A'}
        </span>
      </div>
    </div>
  )
}
