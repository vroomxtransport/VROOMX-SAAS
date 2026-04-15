'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recalculateOrderDistance } from '@/app/actions/order-distance'

interface RecalculateDistanceButtonProps {
  orderId: string
  disabled?: boolean
  disabledReason?: string
}

/**
 * Re-runs the Mapbox geocode + distance calculation for an existing
 * order. Surfaced on order detail whenever the initial geocode failed,
 * was skipped (missing city/state), or the distance column is empty.
 * Disabled — with an explanatory tooltip — when the user hasn't
 * provided the fields needed to geocode (no sense spending a Mapbox
 * call that is guaranteed to return 'skipped').
 */
export function RecalculateDistanceButton({
  orderId,
  disabled,
  disabledReason,
}: RecalculateDistanceButtonProps) {
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)

  const handleClick = async () => {
    setIsRunning(true)
    try {
      const result = await recalculateOrderDistance({ orderId })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.status === 'ok' && result.miles !== null) {
        toast.success(`Distance recalculated: ${result.miles} mi`)
      } else if (result.status === 'skipped') {
        toast.info(result.error ?? 'Skipped — missing pickup or delivery city/state')
      } else {
        toast.error(result.error ?? 'Recalculation failed')
      }
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isRunning}
      title={disabled ? disabledReason : 'Re-run Mapbox distance calculation'}
    >
      {isRunning ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
      )}
      Recalculate
    </Button>
  )
}
