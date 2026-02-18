'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TripRouteMapContainer } from './trip-route-map-container'
import { TripRouteSequence } from './trip-route-sequence'
import { Map, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { Order, RouteStop } from '@/types/database'

interface TripRouteSectionProps {
  tripId: string
  routeSequence: RouteStop[] | null
}

export function TripRouteSection({ tripId, routeSequence }: TripRouteSectionProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
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
              <div className="lg:col-span-2">
                <TripRouteMapContainer
                  orders={orders}
                  sequence={liveSequence}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
