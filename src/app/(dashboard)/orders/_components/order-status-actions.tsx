'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateOrderStatus, rollbackOrderStatus } from '@/app/actions/orders'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronRight, Undo2, XCircle, Loader2 } from 'lucide-react'
import type { OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'

// Defines the allowed forward transitions
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: 'assigned',
  assigned: 'picked_up',
  picked_up: 'delivered',
  delivered: 'invoiced',
  invoiced: 'paid',
}

// Defines which statuses can roll back
const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  assigned: 'new',
  picked_up: 'assigned',
  delivered: 'picked_up',
  invoiced: 'delivered',
  paid: 'invoiced',
}

// Cancellation is allowed from these statuses
const CANCELLABLE: OrderStatus[] = ['new', 'assigned', 'picked_up']

interface OrderStatusActionsProps {
  orderId: string
  currentStatus: OrderStatus
}

export function OrderStatusActions({ orderId, currentStatus }: OrderStatusActionsProps) {
  const queryClient = useQueryClient()
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  const nextStatus = NEXT_STATUS[currentStatus]
  const prevStatus = PREV_STATUS[currentStatus]
  const canCancel = CANCELLABLE.includes(currentStatus)

  const invalidateOrder = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }, [queryClient, orderId])

  const handleAdvance = useCallback(async () => {
    if (!nextStatus) return
    setIsAdvancing(true)
    try {
      const result = await updateOrderStatus(orderId, nextStatus)
      if ('error' in result && result.error) {
        // Could show toast here in future
        console.error('Failed to advance status:', result.error)
        return
      }
      invalidateOrder()
    } finally {
      setIsAdvancing(false)
    }
  }, [orderId, nextStatus, invalidateOrder])

  const handleRollback = useCallback(async () => {
    setIsRollingBack(true)
    try {
      const result = await rollbackOrderStatus(orderId)
      if ('error' in result && result.error) {
        console.error('Failed to rollback status:', result.error)
        return
      }
      invalidateOrder()
    } finally {
      setIsRollingBack(false)
    }
  }, [orderId, invalidateOrder])

  const handleCancel = useCallback(async () => {
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancellation')
      return
    }
    setIsCancelling(true)
    setCancelError('')
    try {
      const result = await updateOrderStatus(orderId, 'cancelled', cancelReason)
      if ('error' in result && result.error) {
        setCancelError(typeof result.error === 'string' ? result.error : 'Failed to cancel order')
        return
      }
      invalidateOrder()
      setCancelOpen(false)
      setCancelReason('')
    } finally {
      setIsCancelling(false)
    }
  }, [orderId, cancelReason, invalidateOrder])

  // If the order is paid or cancelled, no actions available
  if (currentStatus === 'paid' || currentStatus === 'cancelled') {
    return null
  }

  const isLoading = isAdvancing || isRollingBack || isCancelling

  return (
    <div className="flex items-center gap-2">
      {/* Advance button */}
      {nextStatus && (
        <Button
          onClick={handleAdvance}
          disabled={isLoading}
          size="sm"
        >
          {isAdvancing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronRight className="mr-2 h-4 w-4" />
          )}
          Advance to {ORDER_STATUS_LABELS[nextStatus]}
        </Button>
      )}

      {/* Rollback button */}
      {prevStatus && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRollbackOpen(true)}
          disabled={isLoading}
        >
          {isRollingBack ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="mr-2 h-4 w-4" />
          )}
          Roll Back
        </Button>
      )}

      {/* Cancel button */}
      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => setCancelOpen(true)}
          disabled={isLoading}
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel Order
        </Button>
      )}

      {/* Rollback confirmation */}
      <ConfirmDialog
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        title="Roll Back Status"
        description={`Roll back this order from "${ORDER_STATUS_LABELS[currentStatus]}" to "${ORDER_STATUS_LABELS[prevStatus!]}"?`}
        confirmLabel="Roll Back"
        onConfirm={handleRollback}
      />

      {/* Cancel dialog with reason */}
      <AlertDialog open={cancelOpen} onOpenChange={(open) => {
        setCancelOpen(open)
        if (!open) {
          setCancelReason('')
          setCancelError('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the order. Please provide a reason for cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                if (cancelError) setCancelError('')
              }}
              rows={3}
            />
            {cancelError && (
              <p className="mt-1.5 text-sm text-red-600">{cancelError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Order
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleCancel()
              }}
              disabled={isCancelling}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
