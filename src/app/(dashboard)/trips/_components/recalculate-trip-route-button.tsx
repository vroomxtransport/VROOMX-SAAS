'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, RouteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recalculateTripRoute } from '@/app/actions/trip-route'

interface RecalculateTripRouteButtonProps {
  tripId: string
  /** When true, render an inline ghost button (in the section header).
   *  When false, full-bleed alert button. */
  inline?: boolean
}

/**
 * Triggers a Mapbox Directions recalculation for the trip's full
 * ordered route. Surfaces in the trip route section header whenever
 * the trip has no cached `route_geometry` yet — typically legacy
 * trips created before the trip-level routing feature shipped, or
 * trips where the inter-stop sequence hasn't been saved yet.
 */
export function RecalculateTripRouteButton({
  tripId,
  inline = true,
}: RecalculateTripRouteButtonProps) {
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)

  const handleClick = async () => {
    setIsRunning(true)
    try {
      const result = await recalculateTripRoute({ tripId })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (result.status === 'ok' && result.miles !== null) {
        toast.success(`Route recalculated — ${result.miles} mi.`)
      } else if (result.status === 'skipped') {
        toast.info(result.error ?? 'Route recalculation was skipped.')
      } else {
        toast.error(result.error ?? 'Route recalculation failed.')
      }
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <Button
      type="button"
      variant={inline ? 'ghost' : 'outline'}
      size="sm"
      onClick={handleClick}
      disabled={isRunning}
      title="Recompute the road-following route through every stop"
    >
      {isRunning ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RouteIcon className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isRunning ? 'Recalculating…' : 'Recalculate route'}
    </Button>
  )
}
