'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { unassignOrderFromTrip } from '@/app/actions/trips'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { AssignOrderDialog } from './assign-order-dialog'
import {
  Plus,
  X,
  AlertTriangle,
  Package,
  Loader2,
} from 'lucide-react'
import { TRUCK_CAPACITY } from '@/types'
import type { TruckType, OrderStatus } from '@/types'
import type { Order, Broker } from '@/types/database'

interface TripOrderWithBroker extends Order {
  broker: Pick<Broker, 'id' | 'name'> | null
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

interface TripOrdersProps {
  tripId: string
  truckType?: TruckType
}

export function TripOrders({ tripId, truckType }: TripOrdersProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [unassignOrderId, setUnassignOrderId] = useState<string | null>(null)
  const [isUnassigning, setIsUnassigning] = useState(false)

  const capacity = truckType ? TRUCK_CAPACITY[truckType] : null

  const { data: orders = [], isPending } = useQuery({
    queryKey: ['trip-orders', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, broker:brokers(id, name)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as TripOrderWithBroker[]
    },
    staleTime: 30_000,
  })

  // Realtime invalidation for trip orders
  useEffect(() => {
    const channel = supabase
      .channel(`trip-orders-${tripId}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tripId])

  const handleUnassign = useCallback(async () => {
    if (!unassignOrderId) return
    setIsUnassigning(true)
    try {
      const result = await unassignOrderFromTrip(unassignOrderId)
      if ('error' in result && result.error) {
        console.error('Failed to unassign order:', result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] })
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
    } finally {
      setIsUnassigning(false)
      setUnassignOrderId(null)
    }
  }, [unassignOrderId, tripId, queryClient])

  const isOverCapacity = capacity !== null && orders.length > capacity

  return (
    <div className="rounded-lg border bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">
            Orders ({orders.length})
          </h2>
          {capacity !== null && (
            <span className="text-sm text-gray-500">
              / {capacity} capacity
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setAssignDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Order
        </Button>
      </div>

      {/* Capacity Warning */}
      {isOverCapacity && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-700">
            Capacity exceeded: {orders.length} orders on a {truckType ? TRUCK_CAPACITY[truckType] : '?'}-car hauler
          </p>
        </div>
      )}

      {/* Orders List */}
      <div className="divide-y">
        {isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No orders assigned. Click &quot;Add Order&quot; to assign orders to this trip.
          </div>
        ) : (
          orders.map((order) => {
            const vehicleInfo = [
              order.vehicle_year,
              order.vehicle_make,
              order.vehicle_model,
            ]
              .filter(Boolean)
              .join(' ') || 'No vehicle info'

            const route = [order.pickup_state, order.delivery_state]
              .filter(Boolean)
              .join(' → ') || 'No route'

            return (
              <div
                key={order.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  {/* Order number + vehicle */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {order.order_number ?? 'Draft'}
                      </Link>
                      <StatusBadge status={order.status} type="order" />
                    </div>
                    <p className="text-xs text-gray-500">{vehicleInfo}</p>
                  </div>

                  {/* Route */}
                  <div className="shrink-0">
                    <p className="text-xs font-medium text-gray-900">{route}</p>
                  </div>

                  {/* Revenue + Broker Fee */}
                  <div className="flex shrink-0 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Revenue</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.revenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Broker Fee</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.broker_fee)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-8 w-8 shrink-0 p-0 text-gray-400 hover:text-red-600"
                  onClick={() => setUnassignOrderId(order.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )
          })
        )}
      </div>

      {/* Assign Order Dialog */}
      <AssignOrderDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        tripId={tripId}
        currentOrderCount={orders.length}
        truckType={truckType}
      />

      {/* Unassign Confirmation */}
      <ConfirmDialog
        open={!!unassignOrderId}
        onOpenChange={(open) => {
          if (!open) setUnassignOrderId(null)
        }}
        title="Remove Order from Trip"
        description="This will unassign the order from this trip and reset its status to 'New'. The trip financials will be recalculated."
        confirmLabel="Remove"
        destructive
        onConfirm={handleUnassign}
      />
    </div>
  )
}
