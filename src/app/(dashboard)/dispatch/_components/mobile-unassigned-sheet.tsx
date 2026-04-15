'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, ChevronRight, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useUnassignedOrders } from '@/hooks/use-unassigned-orders'
import { useTrips } from '@/hooks/use-trips'
import { assignOrderToTrip } from '@/app/actions/trips'
import { TRIP_STATUS_LABELS } from '@/types'
import type { TripStatus } from '@/types'
import type { UnassignedOrderWithBroker } from '@/hooks/use-unassigned-orders'
import { cn } from '@/lib/utils'

// ─── Floating pill trigger ──────────────────────────────────────────────────

interface MobileUnassignedSheetProps {
  className?: string
}

export function MobileUnassignedSheet({ className }: MobileUnassignedSheetProps) {
  const [open, setOpen] = useState(false)
  const { data: orders } = useUnassignedOrders()
  const count = orders?.length ?? 0

  if (count === 0) return null

  return (
    <>
      {/* Floating amber pill */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-2',
          'border text-amber-700',
          'text-sm font-medium shadow-sm',
          'active:scale-95 transition-transform duration-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
          className,
        )}
        aria-label={`${count} unassigned orders — tap to assign`}
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>{count} Unassigned {count === 1 ? 'Order' : 'Orders'}</span>
        <ChevronRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      </button>

      {/* Bottom sheet */}
      <UnassignedOrdersBottomSheet
        open={open}
        onOpenChange={setOpen}
        orders={orders ?? []}
      />
    </>
  )
}

// ─── Bottom sheet ──────────────────────────────────────────────────────────

interface UnassignedOrdersBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: UnassignedOrderWithBroker[]
}

function UnassignedOrdersBottomSheet({
  open,
  onOpenChange,
  orders,
}: UnassignedOrdersBottomSheetProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80dvh] rounded-t-2xl px-0 pb-[env(safe-area-inset-bottom,0px)] flex flex-col"
      >
        <SheetHeader className="px-4 pb-3 border-b border-border-subtle shrink-0">
          <SheetTitle className="text-base">Unassigned Orders</SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} need a trip assignment
          </p>
        </SheetHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {selectedOrderId ? (
            <TripPickerPanel
              orderId={selectedOrderId}
              order={orders.find((o) => o.id === selectedOrderId)!}
              onBack={() => setSelectedOrderId(null)}
              onAssigned={() => {
                setSelectedOrderId(null)
                onOpenChange(false)
              }}
            />
          ) : (
            <OrderListPanel
              orders={orders}
              onSelectOrder={setSelectedOrderId}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Order list panel ──────────────────────────────────────────────────────

interface OrderListPanelProps {
  orders: UnassignedOrderWithBroker[]
  onSelectOrder: (id: string) => void
}

function OrderListPanel({ orders, onSelectOrder }: OrderListPanelProps) {
  return (
    <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
      {orders.map((order) => {
        const vehicleName = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
          .filter(Boolean)
          .join(' ') || 'Unknown Vehicle'

        const pickupCity = order.pickup_city && order.pickup_state
          ? `${order.pickup_city}, ${order.pickup_state}`
          : null
        const deliveryCity = order.delivery_city && order.delivery_state
          ? `${order.delivery_city}, ${order.delivery_state}`
          : null

        const route = [pickupCity, deliveryCity].filter(Boolean).join(' \u2192') || 'No route'

        const revenue = parseFloat(order.revenue ?? '0')
        const formattedRevenue = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(revenue)

        return (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelectOrder(order.id)}
            className={cn(
              'w-full text-left rounded-xl border border-border-subtle bg-surface p-3.5',
              'active:scale-[0.98] transition-transform duration-100',
              'hover:border-brand/30 hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
              'min-h-[44px]',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{vehicleName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{route}</p>
                {order.broker?.name && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                    via {order.broker.name}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-semibold text-foreground">{formattedRevenue}</span>
                <span className="text-[10px] text-muted-foreground">{order.order_number ?? 'N/A'}</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-end">
              <span className="flex items-center gap-1 text-xs font-medium text-brand">
                Assign to trip
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Trip picker panel ─────────────────────────────────────────────────────

const TRIP_STATUS_DOT: Record<TripStatus, string> = {
  planned: 'bg-blue-400',
  in_progress: 'bg-amber-400',
  at_terminal: 'bg-purple-400',
  completed: 'bg-green-400',
}

interface TripPickerPanelProps {
  orderId: string
  order: UnassignedOrderWithBroker
  onBack: () => void
  onAssigned: () => void
}

function TripPickerPanel({ orderId, order, onBack, onAssigned }: TripPickerPanelProps) {
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null)

  // Fetch active trips to pick from (planned + in_progress + at_terminal)
  const { data: plannedData } = useTrips({ status: 'planned', pageSize: 50 })
  const { data: inProgressData } = useTrips({ status: 'in_progress', pageSize: 50 })
  const { data: atTerminalData } = useTrips({ status: 'at_terminal', pageSize: 50 })

  const allTrips = [
    ...(plannedData?.trips ?? []),
    ...(inProgressData?.trips ?? []),
    ...(atTerminalData?.trips ?? []),
  ]

  const vehicleName = [order.vehicle_year, order.vehicle_make, order.vehicle_model]
    .filter(Boolean)
    .join(' ') || 'Unknown Vehicle'

  const handleAssign = (tripId: string) => {
    setAssigningTripId(tripId)
    startTransition(async () => {
      const result = await assignOrderToTrip(orderId, tripId)
      if ('error' in result && result.error) {
        toast.error('Failed to assign order', { description: String(result.error) })
        setAssigningTripId(null)
      } else {
        toast.success('Order assigned to trip')
        queryClient.invalidateQueries({ queryKey: ['trips'] })
        queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
        onAssigned()
      }
    })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Sub-header with back + order info */}
      <div className="px-4 py-3 border-b border-border-subtle shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-brand font-medium mb-2 focus-visible:outline-none"
        >
          ← Back to orders
        </button>
        <p className="text-sm font-medium text-foreground truncate">{vehicleName}</p>
        <p className="text-xs text-muted-foreground">Select a trip to assign this order to</p>
      </div>

      {/* Trip list */}
      <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
        {allTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No active trips available</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create a trip first</p>
          </div>
        ) : (
          allTrips.map((trip) => {
            const tripStatus = trip.status as TripStatus
            const driverName = trip.driver
              ? `${trip.driver.first_name} ${trip.driver.last_name.charAt(0)}.`
              : 'Unassigned'
            const isAssigning = isPending && assigningTripId === trip.id

            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => handleAssign(trip.id)}
                disabled={isPending}
                className={cn(
                  'w-full text-left rounded-xl border border-border-subtle bg-surface p-3.5',
                  'active:scale-[0.98] transition-all duration-100',
                  'hover:border-brand/30 hover:shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                  'min-h-[44px]',
                  'disabled:opacity-60 disabled:pointer-events-none',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        TRIP_STATUS_DOT[tripStatus],
                      )}
                    />
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {trip.trip_number ?? 'N/A'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {TRIP_STATUS_LABELS[tripStatus]}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {isAssigning ? (
                      <Loader2 className="h-4 w-4 text-brand animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{driverName}</span>
                  {trip.truck?.unit_number && (
                    <>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="text-xs text-muted-foreground">{trip.truck.unit_number}</span>
                    </>
                  )}
                </div>

                {(trip.origin_summary ?? trip.destination_summary) && (
                  <div className="mt-1 text-xs text-muted-foreground/70 truncate">
                    {[trip.origin_summary, trip.destination_summary]
                      .filter(Boolean)
                      .join(' \u2192')}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
