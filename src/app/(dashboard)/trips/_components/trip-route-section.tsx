'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TripRouteMapContainer } from './trip-route-map-container'
import { TripRouteSequence } from './trip-route-sequence'
import { Map, ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useTrip } from '@/hooks/use-trips'
import { RecalculateTripRouteButton } from './recalculate-trip-route-button'
import type { Order, RouteStop } from '@/types/database'

interface TripRouteSectionProps {
  tripId: string
  routeSequence: RouteStop[] | null
}

export function TripRouteSection({ tripId, routeSequence }: TripRouteSectionProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  // Pull the cached trip-level driving polyline. useTrip is already
  // the canonical loader for the trip detail page, so this just
  // hooks into the same query cache (no extra network round-trip).
  const { data: trip } = useTrip(tripId)
  const tripRouteGeometry = (trip?.route_geometry ?? null) as
    | { type: 'LineString'; coordinates: [number, number][] }
    | null
  const [isOpen, setIsOpen] = useState(true)

  // Re-use the same query key as TripOrders to share cache
  const { data: orders = [], isPending } = useQuery({
    queryKey: ['trip-orders', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, broker:brokers(id, name)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Order[]
    },
    staleTime: 30_000,
  })

  // Realtime invalidation for order changes (coordinates may update async)
  useEffect(() => {
    const channel = supabase
      .channel(`trip-route-orders-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['trip-orders', tripId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, tripId])

  // Local sequence state for live map updates on drag
  const [liveSequence, setLiveSequence] = useState<RouteStop[] | null>(routeSequence)

  const handleSequenceChange = useCallback((seq: RouteStop[]) => {
    setLiveSequence(seq)
  }, [])

  // Don't render if no orders assigned
  if (!isPending && orders.length === 0) return null

  const hasGeocodedOrders = orders.some(
    (o) => o.pickup_latitude != null || o.delivery_latitude != null
  )

  // Surface partial geocode failures to the user. An order counts as
  // "failed" when its geocode_status is explicitly failed/skipped, OR
  // when the order has city+state filled on both ends but no
  // coordinates landed (back-compat for orders saved before the
  // status column existed). Each failed order shows a Recalculate
  // button in the sequence panel; this banner is the global signal.
  const failedOrders = orders.filter((o) => {
    if (o.geocode_status === 'failed' || o.geocode_status === 'skipped') return true
    const hasAddresses =
      o.pickup_city && o.pickup_state && o.delivery_city && o.delivery_state
    const missingCoords =
      o.pickup_latitude == null ||
      o.pickup_longitude == null ||
      o.delivery_latitude == null ||
      o.delivery_longitude == null
    return Boolean(hasAddresses && missingCoords && o.geocode_status !== 'pending')
  })
  const failedCount = failedOrders.length

  return (
    <div className="rounded-lg border bg-surface">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <Map className="h-5 w-5 text-muted-foreground/60" />
        <h2 className="text-lg font-semibold text-foreground flex-1">Route Map</h2>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!hasGeocodedOrders && orders.length > 0 && !isPending && (
          <span className="text-xs text-muted-foreground">(Geocoding...)</span>
        )}
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="border-t px-4 py-4">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
            </div>
          ) : (
            <div className="space-y-3">
              {failedCount > 0 && (
                <div className="flex items-start gap-3 rounded-md border border-[var(--state-warn-border)] bg-[var(--state-warn-bg)] px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--state-warn-text)]" />
                  <div className="flex-1 text-sm text-[var(--state-warn-text)]">
                    <span className="font-medium">
                      {failedCount === 1
                        ? '1 stop couldn’t be geocoded.'
                        : `${failedCount} stops couldn’t be geocoded.`}{' '}
                    </span>
                    <span className="text-[var(--state-warn-text)]/85">
                      Open each order to recalculate the route, or fix the address.
                    </span>
                  </div>
                  {failedOrders[0] && (
                    <Link
                      href={`/orders/${failedOrders[0].id}`}
                      className="text-xs font-medium text-[var(--state-warn-text)] underline-offset-2 hover:underline"
                    >
                      Review →
                    </Link>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Sequence Panel (1/3) */}
              <div className="lg:col-span-1">
                <TripRouteSequence
                  tripId={tripId}
                  orders={orders}
                  savedSequence={routeSequence}
                  onSequenceChange={handleSequenceChange}
                />
              </div>

              {/* Map (2/3) */}
              <div className="lg:col-span-2 space-y-2">
                {!tripRouteGeometry && orders.length > 0 && (
                  <div className="flex items-center justify-end">
                    <RecalculateTripRouteButton tripId={tripId} />
                  </div>
                )}
                <TripRouteMapContainer
                  orders={orders}
                  sequence={liveSequence}
                  tripRouteGeometry={tripRouteGeometry}
                />
              </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
