'use client'

import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Pencil, ArrowRight } from 'lucide-react'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderRowProps {
  order: OrderWithRelations
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatVehicle(order: OrderWithRelations): string {
  const parts: string[] = []
  if (order.vehicle_year) parts.push(String(order.vehicle_year))
  if (order.vehicle_make) parts.push(order.vehicle_make)
  if (order.vehicle_model) parts.push(order.vehicle_model)
  return parts.join(' ') || 'No vehicle info'
}

export function OrderRow({ order, onClick, onEdit }: OrderRowProps) {
  const revenue = parseFloat(order.revenue)
  const driverName = order.driver
    ? `${order.driver.first_name} ${order.driver.last_name}`
    : null

  const pickupCity = [order.pickup_city, order.pickup_state].filter(Boolean).join(', ')
  const deliveryCity = [order.delivery_city, order.delivery_state].filter(Boolean).join(', ')

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="flex w-full items-center gap-4 rounded-lg border border-border-subtle bg-surface px-4 py-3 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      {/* Order number */}
      <div className="flex items-center gap-2 shrink-0 w-[90px]">
        <span className="text-sm font-semibold text-gray-900 truncate">
          {order.order_number ?? 'Draft'}
        </span>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={order.status} type="order" />
      </div>

      {/* Vehicle */}
      <div className="min-w-0 flex-1 truncate text-sm text-gray-700">
        {formatVehicle(order)}
      </div>

      {/* Route */}
      {(pickupCity || deliveryCity) && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500 shrink-0 max-w-[240px]">
          <span className="truncate">{pickupCity || 'TBD'}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-gray-400" />
          <span className="truncate">{deliveryCity || 'TBD'}</span>
        </div>
      )}

      {/* Driver */}
      {driverName && (
        <div className="hidden lg:block text-xs text-gray-500 shrink-0 w-[120px] truncate">
          {driverName}
        </div>
      )}

      {/* Revenue */}
      <div className="text-sm font-semibold text-gray-900 tabular-nums shrink-0 w-[70px] text-right">
        {revenue > 0 ? formatCurrency(revenue) : '--'}
      </div>

      {/* Edit */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
