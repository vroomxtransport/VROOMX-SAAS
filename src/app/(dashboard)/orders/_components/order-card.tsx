'use client'

import { EntityCard } from '@/components/shared/entity-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Pencil, ArrowRight } from 'lucide-react'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderCardProps {
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

function formatRoute(order: OrderWithRelations): { from: string; to: string } | null {
  const from = [order.pickup_city, order.pickup_state].filter(Boolean).join(', ')
  const to = [order.delivery_city, order.delivery_state].filter(Boolean).join(', ')
  if (!from && !to) return null
  return { from: from || 'TBD', to: to || 'TBD' }
}

function formatDriverName(driver: OrderWithRelations['driver']): string | null {
  if (!driver) return null
  return `${driver.first_name} ${driver.last_name}`
}

export function OrderCard({ order, onClick, onEdit }: OrderCardProps) {
  const route = formatRoute(order)
  const driverName = formatDriverName(order.driver)
  const revenue = parseFloat(order.revenue)

  return (
    <EntityCard onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {order.order_number ?? 'Draft'}
            </span>
            <StatusBadge status={order.status} type="order" />
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-foreground">
            {formatVehicle(order)}
          </h3>
        </div>
        <div className="ml-2 flex items-center" onClick={(e) => e.stopPropagation()}>
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

      {route && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{route.from}</span>
          <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
          <span className="truncate">{route.to}</span>
        </div>
      )}

      {order.broker && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Broker: {order.broker.name}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5">
        <span className="text-sm font-semibold text-foreground">
          {revenue > 0 ? formatCurrency(revenue) : '--'}
        </span>
        {driverName && (
          <span className="text-xs text-muted-foreground">{driverName}</span>
        )}
      </div>
    </EntityCard>
  )
}
