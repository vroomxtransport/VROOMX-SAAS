'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { assignOrderToTrip } from '@/app/actions/trips'
import { useUnassignedOrders } from '@/hooks/use-unassigned-orders'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import {
  Search,
  Plus,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { TRUCK_CAPACITY } from '@/types'
import type { TruckType } from '@/types'

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

interface AssignOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
  currentOrderCount: number
  truckType?: TruckType
}

export function AssignOrderDialog({
  open,
  onOpenChange,
  tripId,
  currentOrderCount,
  truckType,
}: AssignOrderDialogProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const capacity = truckType ? TRUCK_CAPACITY[truckType] : null
  const isOverCapacity = capacity !== null && currentOrderCount >= capacity

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search])

  // Reset search when dialog opens
  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
    }
  }, [open])

  const { data: orders = [], isPending } = useUnassignedOrders(debouncedSearch || undefined)

  const handleAssign = useCallback(async (orderId: string) => {
    setAssigningId(orderId)
    try {
      const result = await assignOrderToTrip(orderId, tripId)
      if ('error' in result && result.error) {
        console.error('Failed to assign order:', result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] })
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
      // Stay open for batch assignment
    } finally {
      setAssigningId(null)
    }
  }, [tripId, queryClient])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Orders to Trip</DialogTitle>
          <DialogDescription>
            Search and assign unassigned orders to this trip.
          </DialogDescription>
        </DialogHeader>

        {/* Capacity Warning */}
        {isOverCapacity && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Trip is at or over capacity ({currentOrderCount}/{capacity}). You can still assign orders.
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search by order number, VIN, or make..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Orders List */}
        <div className="max-h-[400px] overflow-y-auto divide-y rounded-md border">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
            </div>
          ) : orders.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {debouncedSearch
                ? `No unassigned orders matching "${debouncedSearch}".`
                : 'No unassigned orders found.'}
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

              const isAssigning = assigningId === order.id

              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    {/* Order number + vehicle */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {order.order_number ?? 'Draft'}
                        </span>
                        <StatusBadge status={order.status} type="order" />
                      </div>
                      <p className="text-xs text-muted-foreground">{vehicleInfo}</p>
                    </div>

                    {/* Route */}
                    <div className="shrink-0">
                      <p className="text-xs font-medium text-foreground">{route}</p>
                    </div>

                    {/* Revenue */}
                    <div className="shrink-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatCurrency(order.revenue)}
                      </p>
                    </div>
                  </div>

                  {/* Assign button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 shrink-0"
                    onClick={() => handleAssign(order.id)}
                    disabled={!!assigningId}
                  >
                    {isAssigning ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3.5 w-3.5" />
                    )}
                    Assign
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
