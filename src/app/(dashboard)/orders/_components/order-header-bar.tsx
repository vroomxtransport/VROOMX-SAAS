'use client'

import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Trash2,
  DollarSign,
  MapPin,
  Building2,
  Receipt,
} from 'lucide-react'
import { PAYMENT_TYPE_LABELS } from '@/types'
import type { OrderStatus } from '@/types'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderHeaderBarProps {
  order: OrderWithRelations
  onEdit: () => void
  onDelete: () => void
  canDelete: boolean
}

const STATUS_GRADIENTS: Record<string, string> = {
  new: 'bg-gradient-to-r from-blue-400 to-blue-600',
  assigned: 'bg-gradient-to-r from-amber-400 to-amber-600',
  picked_up: 'bg-gradient-to-r from-purple-400 to-purple-600',
  delivered: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
  invoiced: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
  paid: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
  cancelled: 'bg-gradient-to-r from-red-400 to-red-600',
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function OrderHeaderBar({ order, onEdit, onDelete, canDelete }: OrderHeaderBarProps) {
  const status = order.status as OrderStatus
  const gradient = STATUS_GRADIENTS[status] ?? STATUS_GRADIENTS.new

  const vehicleInfo = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean)
    .join(' ')
  const vinExcerpt = order.vehicle_vin
    ? `VIN: ...${order.vehicle_vin.slice(-6)}`
    : null

  const revenue = parseFloat(order.revenue)
  const distance = order.pickup_state && order.delivery_state
    ? `${order.pickup_state} → ${order.delivery_state}`
    : null

  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
      {/* Status accent stripe */}
      <div className={cn('h-1 w-full', gradient)} />

      {/* Main content */}
      <div className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Order number + status */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {order.order_number ?? 'Draft Order'}
            </h1>
            <StatusBadge status={order.status} type="order" />
          </div>

          {/* Center: Vehicle subtitle */}
          <div className="hidden sm:flex sm:flex-col sm:items-center">
            {vehicleInfo && (
              <p className="text-sm text-muted-foreground">{vehicleInfo}</p>
            )}
            {vinExcerpt && (
              <p className="text-xs text-muted-foreground">{vinExcerpt}</p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Metric strip */}
        <div className="flex flex-wrap gap-6 mt-3 pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(revenue)}</p>
            </div>
          </div>

          {distance && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="text-sm font-semibold">{distance}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Broker</p>
              <p className="text-sm font-semibold">{order.broker?.name ?? 'Unassigned'}</p>
            </div>
          </div>

          {order.payment_type && (
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="text-sm font-semibold">{PAYMENT_TYPE_LABELS[order.payment_type]}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
