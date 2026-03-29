'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EntityCard } from '@/components/shared/entity-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Pencil, ArrowRight, UserPlus, UserCog, UserMinus, Trash2, MapPinned } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { updateOrder, deleteOrder } from '@/app/actions/orders'
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
  const [showDriverPopover, setShowDriverPopover] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const queryClient = useQueryClient()
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  const route = formatRoute(order)
  const driverName = formatDriverName(order.driver)
  const revenue = parseFloat(order.revenue)

  async function handleAssignDriver(driverId: string) {
    setIsAssigning(true)
    try {
      const result = await updateOrder(order.id, { driverId })
      if (!('error' in result && result.error)) {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        setShowDriverPopover(false)
      }
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleUnassignDriver(e: React.MouseEvent) {
    e.stopPropagation()
    setIsAssigning(true)
    try {
      const result = await updateOrder(order.id, { driverId: '' })
      if (!('error' in result && result.error)) {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleDelete() {
    const result = await deleteOrder(order.id)
    if (!('error' in result && result.error)) {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  }

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

      {/* Broker + Payment + Dates row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {order.broker && (
          <span>Broker: <span className="text-foreground/80">{order.broker.name}</span></span>
        )}
        {order.payment_type && (
          <span>Pay: <span className="text-foreground/80">{order.payment_type}</span></span>
        )}
        {(order.pickup_date || order.delivery_date) && (
          <span>
            {order.pickup_date ? new Date(order.pickup_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
            {' → '}
            {order.delivery_date ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-1.5">
        <div>
          <span className="text-sm font-semibold text-foreground">
            {revenue > 0 ? formatCurrency(revenue) : '--'}
          </span>
          {order.payment_type === 'SPLIT' && order.cod_amount && order.billing_amount && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
              <span className="text-emerald-600">
                COD {formatCurrency(order.cod_amount)}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-brand">
                Bill {formatCurrency(order.billing_amount)}
              </span>
            </div>
          )}
        </div>
        {driverName && (
          <span className="text-xs text-muted-foreground">{driverName}</span>
        )}
      </div>

      {/* Quick Actions */}
      <div
        className="flex items-center gap-1.5 pt-2 mt-2 border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {order.driver ? (
          <>
            <Popover open={showDriverPopover} onOpenChange={setShowDriverPopover}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                  disabled={isAssigning}
                >
                  <UserCog className="h-3 w-3" />
                  Reassign
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <p className="text-xs font-medium text-muted-foreground mb-2">Select driver</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {driversData?.drivers?.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => handleAssignDriver(driver.id)}
                      disabled={isAssigning}
                      className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {driver.first_name} {driver.last_name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="xs"
              className="gap-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleUnassignDriver}
              disabled={isAssigning}
            >
              <UserMinus className="h-3 w-3" />
              Unassign
            </Button>
          </>
        ) : (
          <Popover open={showDriverPopover} onOpenChange={setShowDriverPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                disabled={isAssigning}
              >
                <UserPlus className="h-3 w-3" />
                Assign
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <p className="text-xs font-medium text-muted-foreground mb-2">Select driver</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {driversData?.drivers?.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => handleAssignDriver(driver.id)}
                    disabled={isAssigning}
                    className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {driver.first_name} {driver.last_name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Map */}
        {(order.pickup_city || order.delivery_city) && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              const origin = [order.pickup_location, order.pickup_city, order.pickup_state, order.pickup_zip].filter(Boolean).join(', ')
              const dest = [order.delivery_location, order.delivery_city, order.delivery_state, order.delivery_zip].filter(Boolean).join(', ')
              const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`
              window.open(url, '_blank', 'noopener')
            }}
          >
            <MapPinned className="h-3 w-3" />
            Map
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <ConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          title={`Delete Order ${order.order_number ?? 'Draft'}?`}
          description="This will permanently delete the order and remove it from any assigned trip. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
        />
      </div>
    </EntityCard>
  )
}
