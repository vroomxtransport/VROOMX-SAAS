'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CopyIdButton } from '@/components/shared/copy-id-button'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Pencil, ArrowRight, Calendar, UserPlus, UserCog, UserMinus, Trash2, MapPinned } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { updateOrder, deleteOrder } from '@/app/actions/orders'
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
  const [showDriverPopover, setShowDriverPopover] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const queryClient = useQueryClient()
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  const revenue = parseFloat(order.revenue)
  const driverName = order.driver
    ? `${order.driver.first_name} ${order.driver.last_name}`
    : null

  const pickupCity = [order.pickup_city, order.pickup_state].filter(Boolean).join(', ')
  const deliveryCity = [order.delivery_city, order.delivery_state].filter(Boolean).join(', ')

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
      className="flex w-full items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-left shadow-sm transition-colors card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
    >
      {/* Order number */}
      <div className="group/id flex items-center gap-1 shrink-0 w-[110px]">
        <span className="text-sm font-semibold text-foreground truncate">
          {order.order_number ?? 'Draft'}
        </span>
        {order.order_number && (
          <span className="opacity-0 group-hover/id:opacity-100 transition-opacity">
            <CopyIdButton value={order.order_number} />
          </span>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={order.status} type="order" />
      </div>

      {/* Vehicle */}
      <div className="min-w-0 flex-1 truncate text-sm text-foreground">
        {formatVehicle(order)}
      </div>

      {/* Route */}
      {(pickupCity || deliveryCity) && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-foreground/80 shrink-0 max-w-[240px]">
          <span className="truncate">{pickupCity || 'TBD'}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <span className="truncate">{deliveryCity || 'TBD'}</span>
        </div>
      )}

      {/* Broker */}
      <div className="hidden lg:block text-xs text-foreground shrink-0 w-[130px] truncate">
        {order.broker?.name || '--'}
      </div>

      {/* Payment Type */}
      <div className="hidden lg:block text-xs text-foreground shrink-0 w-[60px]">
        {order.payment_type || '--'}
      </div>

      {/* Dates */}
      <div className="hidden xl:flex items-center gap-1 text-xs text-foreground/80 shrink-0 w-[140px]">
        <Calendar className="h-3 w-3 shrink-0 opacity-50" />
        <span>{order.pickup_date ? new Date(order.pickup_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '--'}</span>
        <ArrowRight className="h-2.5 w-2.5 shrink-0 opacity-60" />
        <span>{order.delivery_date ? new Date(order.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '--'}</span>
      </div>

      {/* Driver */}
      <div className="hidden lg:block text-xs text-foreground shrink-0 w-[120px] truncate">
        {driverName || '--'}
      </div>

      {/* Revenue */}
      <div className="shrink-0 w-[70px] text-right">
        <div className="text-sm font-semibold text-foreground tabular-nums">
          {revenue > 0 ? formatCurrency(revenue) : '--'}
        </div>
        {order.payment_type === 'SPLIT' && order.cod_amount && order.billing_amount && (
          <div className="text-xs text-muted-foreground tabular-nums">
            <span className="text-emerald-600">COD {formatCurrency(order.cod_amount)}</span>
            {' / '}
            <span className="text-brand">Bill {formatCurrency(order.billing_amount)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <TooltipProvider>
          {/* Edit */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Order</TooltipContent>
          </Tooltip>

          {/* Assign / Reassign */}
          <Popover open={showDriverPopover} onOpenChange={setShowDriverPopover}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={isAssigning}
                  >
                    {order.driver ? (
                      <UserCog className="h-3.5 w-3.5" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {order.driver ? 'Reassign Driver' : 'Assign Driver'}
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-2" align="end">
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

          {/* Unassign — only shown when a driver is assigned */}
          {order.driver && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleUnassignDriver}
                  disabled={isAssigning}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Unassign Driver</TooltipContent>
            </Tooltip>
          )}

          {/* Map */}
          {(order.pickup_city || order.delivery_city) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const origin = [order.pickup_location, order.pickup_city, order.pickup_state, order.pickup_zip].filter(Boolean).join(', ')
                    const dest = [order.delivery_location, order.delivery_city, order.delivery_state, order.delivery_zip].filter(Boolean).join(', ')
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`, '_blank', 'noopener')
                  }}
                >
                  <MapPinned className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Route</TooltipContent>
            </Tooltip>
          )}

          {/* Delete */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Order</TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
    </div>
  )
}
