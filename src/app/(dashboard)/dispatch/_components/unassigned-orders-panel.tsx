'use client'

import { useState, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { PackageSearch, ChevronUp, ChevronDown } from 'lucide-react'
import { useUnassignedOrders } from '@/hooks/use-unassigned-orders'
import type { UnassignedOrderWithBroker } from '@/hooks/use-unassigned-orders'
import { cn } from '@/lib/utils'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

interface UnassignedOrdersPanelProps {
  forceExpanded?: boolean
}

export function UnassignedOrdersPanel({ forceExpanded }: UnassignedOrdersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: orders } = useUnassignedOrders()

  const count = orders?.length ?? 0

  // Auto-expand when forceExpanded is true (e.g., while dragging an order)
  useEffect(() => {
    if (forceExpanded) setIsExpanded(true)
  }, [forceExpanded])

  return (
    <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden">
      {/* Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <PackageSearch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Unassigned Orders</span>
          <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
            {count}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden',
          isExpanded ? 'max-h-[240px]' : 'max-h-0'
        )}
      >
        {count === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No unassigned orders
          </div>
        ) : (
          <div className="p-4 overflow-x-auto flex gap-3 border-t border-border-subtle">
            {orders?.map((order) => (
              <DraggableOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableOrderCard({ order }: { order: UnassignedOrderWithBroker }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: order.id,
    data: { type: 'order', order },
  })

  const vehicleName = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean)
    .join(' ') || 'Unknown Vehicle'

  const route = [
    order.pickup_city && order.pickup_state
      ? `${order.pickup_city}, ${order.pickup_state}`
      : null,
    order.delivery_city && order.delivery_state
      ? `${order.delivery_city}, ${order.delivery_state}`
      : null,
  ]
    .filter(Boolean)
    .join(' \u2192 ') || 'No route'

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'min-w-[220px] max-w-[220px] rounded-lg border border-border-subtle bg-surface p-3 shrink-0 cursor-grab active:cursor-grabbing hover:border-brand/30 transition-all duration-150 touch-none',
        isDragging && 'opacity-40 scale-95'
      )}
    >
      <div className="text-sm font-medium text-foreground truncate" title={vehicleName}>
        {vehicleName}
      </div>
      <div className="mt-1 text-xs text-muted-foreground truncate" title={route}>
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
