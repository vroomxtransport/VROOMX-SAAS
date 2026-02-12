'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateTripStatus } from '@/app/actions/trips'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ChevronRight, Undo2, Loader2 } from 'lucide-react'
import type { TripStatus } from '@/types'
import { TRIP_STATUS_LABELS } from '@/types'

// Forward transitions: planned -> in_progress -> at_terminal -> completed
const NEXT_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  planned: 'in_progress',
  in_progress: 'at_terminal',
  at_terminal: 'completed',
}

// Rollback transitions
const PREV_STATUS: Partial<Record<TripStatus, TripStatus>> = {
  in_progress: 'planned',
  at_terminal: 'in_progress',
  completed: 'at_terminal',
}

// Labels for the advance buttons
const ADVANCE_LABELS: Partial<Record<TripStatus, string>> = {
  planned: 'Start Trip',
  in_progress: 'Mark At Terminal',
  at_terminal: 'Complete Trip',
}

interface TripStatusActionsProps {
  tripId: string
  currentStatus: TripStatus
  orderCount: number
}

export function TripStatusActions({ tripId, currentStatus, orderCount }: TripStatusActionsProps) {
  const queryClient = useQueryClient()
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)

  const nextStatus = NEXT_STATUS[currentStatus]
  const prevStatus = PREV_STATUS[currentStatus]

  const invalidateTrip = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
    queryClient.invalidateQueries({ queryKey: ['trips'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
  }, [queryClient, tripId])

  const handleAdvance = useCallback(async () => {
    if (!nextStatus) return
    setIsAdvancing(true)
    try {
      const result = await updateTripStatus(tripId, nextStatus)
      if ('error' in result && result.error) {
        console.error('Failed to advance trip status:', result.error)
        return
      }
      invalidateTrip()
    } finally {
      setIsAdvancing(false)
    }
  }, [tripId, nextStatus, invalidateTrip])

  const handleRollback = useCallback(async () => {
    if (!prevStatus) return
    setIsRollingBack(true)
    try {
      const result = await updateTripStatus(tripId, prevStatus)
      if ('error' in result && result.error) {
        console.error('Failed to rollback trip status:', result.error)
        return
      }
      invalidateTrip()
    } finally {
      setIsRollingBack(false)
    }
  }, [tripId, prevStatus, invalidateTrip])

  // No actions for completed trips (only rollback)
  if (!nextStatus && !prevStatus) {
    return null
  }

  const isLoading = isAdvancing || isRollingBack

  // Build confirmation messages
  const getAdvanceDescription = (): string => {
    if (!nextStatus) return ''

    if (nextStatus === 'in_progress') {
      return `This will start the trip and mark all ${orderCount} assigned order${orderCount !== 1 ? 's' : ''} as "Picked Up". Continue?`
    }
    if (nextStatus === 'completed') {
      return `This will complete the trip and mark all ${orderCount} assigned order${orderCount !== 1 ? 's' : ''} as "Delivered". Continue?`
    }
    return `Advance trip status from "${TRIP_STATUS_LABELS[currentStatus]}" to "${TRIP_STATUS_LABELS[nextStatus]}"?`
  }

  const getRollbackDescription = (): string => {
    if (!prevStatus) return ''
    return `Roll back trip status from "${TRIP_STATUS_LABELS[currentStatus]}" to "${TRIP_STATUS_LABELS[prevStatus]}"? This will also update associated order statuses.`
  }

  return (
    <div className="flex items-center gap-2">
      {/* Advance button */}
      {nextStatus && (
        <Button
          onClick={() => setAdvanceDialogOpen(true)}
          disabled={isLoading}
          size="sm"
        >
          {isAdvancing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronRight className="mr-2 h-4 w-4" />
          )}
          {ADVANCE_LABELS[currentStatus] ?? `Advance to ${TRIP_STATUS_LABELS[nextStatus]}`}
        </Button>
      )}

      {/* Rollback button */}
      {prevStatus && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRollbackDialogOpen(true)}
          disabled={isLoading}
        >
          {isRollingBack ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="mr-2 h-4 w-4" />
          )}
          Rollback to {TRIP_STATUS_LABELS[prevStatus]}
        </Button>
      )}

      {/* Advance confirmation */}
      {nextStatus && (
        <ConfirmDialog
          open={advanceDialogOpen}
          onOpenChange={setAdvanceDialogOpen}
          title={ADVANCE_LABELS[currentStatus] ?? `Advance to ${TRIP_STATUS_LABELS[nextStatus]}`}
          description={getAdvanceDescription()}
          confirmLabel={ADVANCE_LABELS[currentStatus] ?? 'Advance'}
          onConfirm={handleAdvance}
        />
      )}

      {/* Rollback confirmation */}
      {prevStatus && (
        <ConfirmDialog
          open={rollbackDialogOpen}
          onOpenChange={setRollbackDialogOpen}
          title="Rollback Trip Status"
          description={getRollbackDescription()}
          confirmLabel="Rollback"
          onConfirm={handleRollback}
        />
      )}
    </div>
  )
}
