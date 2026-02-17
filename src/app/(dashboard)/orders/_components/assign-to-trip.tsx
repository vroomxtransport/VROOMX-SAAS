'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { assignOrderToTrip, unassignOrderFromTrip } from '@/app/actions/trips'
import { useTrips } from '@/hooks/use-trips'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Truck,
  ChevronsUpDown,
  Check,
  Loader2,
  ExternalLink,
  X,
  ArrowRightLeft,
} from 'lucide-react'
import { TRIP_STATUS_LABELS } from '@/types'
import type { TripStatus } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'

interface AssignToTripProps {
  orderId: string
  currentTripId: string | null
  currentTripNumber: string | null
  currentTripStatus: TripStatus | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function buildTripLabel(trip: TripWithRelations): string {
  const parts: string[] = []
  parts.push(trip.trip_number ?? 'No #')
  if (trip.driver) {
    parts.push(`${trip.driver.first_name} ${trip.driver.last_name.charAt(0)}.`)
  }
  if (trip.truck) {
    parts.push(trip.truck.unit_number)
  }
  parts.push(`${formatDate(trip.start_date)}-${formatDate(trip.end_date)}`)
  return parts.join(' | ')
}

export function AssignToTrip({
  orderId,
  currentTripId,
  currentTripNumber,
  currentTripStatus,
}: AssignToTripProps) {
  const queryClient = useQueryClient()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch trips filtered to planned and in_progress only (assignable trips)
  const { data: tripsResult, isPending: tripsLoading } = useTrips({
    pageSize: 100,
  })

  // Filter to assignable trips (planned/in_progress) and apply local search
  const assignableTrips = useMemo(() => {
    if (!tripsResult?.trips) return []
    const assignableStatuses: TripStatus[] = ['planned', 'in_progress']
    let filtered = tripsResult.trips.filter((t) =>
      assignableStatuses.includes(t.status as TripStatus)
    )
    // Exclude the current trip from the list (no point selecting the already-assigned trip)
    if (currentTripId) {
      filtered = filtered.filter((t) => t.id !== currentTripId)
    }
    // Apply local search
    if (search.trim()) {
      const s = search.toLowerCase()
      filtered = filtered.filter((t) => {
        const tripNum = (t.trip_number ?? '').toLowerCase()
        const driverName = t.driver
          ? `${t.driver.first_name} ${t.driver.last_name}`.toLowerCase()
          : ''
        const truckUnit = t.truck ? t.truck.unit_number.toLowerCase() : ''
        return tripNum.includes(s) || driverName.includes(s) || truckUnit.includes(s)
      })
    }
    return filtered
  }, [tripsResult, search, currentTripId])

  // Focus search input when popover opens
  useEffect(() => {
    if (popoverOpen) {
      setSearch('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [popoverOpen])

  const handleAssign = useCallback(
    async (tripId: string) => {
      setIsAssigning(true)
      try {
        const result = await assignOrderToTrip(orderId, tripId)
        if ('error' in result && result.error) {
          console.error('Failed to assign order to trip:', result.error)
          return
        }
        queryClient.invalidateQueries({ queryKey: ['order', orderId] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['trips'] })
        queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
        if (currentTripId) {
          queryClient.invalidateQueries({ queryKey: ['trip', currentTripId] })
        }
        setPopoverOpen(false)
      } finally {
        setIsAssigning(false)
      }
    },
    [orderId, currentTripId, queryClient]
  )

  const handleUnassign = useCallback(async () => {
    const result = await unassignOrderFromTrip(orderId)
    if ('error' in result && result.error) {
      console.error('Failed to unassign order from trip:', result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['trips'] })
    if (currentTripId) {
      queryClient.invalidateQueries({ queryKey: ['trip', currentTripId] })
    }
  }, [orderId, currentTripId, queryClient])

  if (isAssigning) {
    return (
      <div className="rounded-lg border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground/60" />
          <h2 className="text-lg font-semibold text-foreground">Trip Assignment</h2>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
          <span className="text-sm text-muted-foreground">Updating trip assignment...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5 text-muted-foreground/60" />
        <h2 className="text-lg font-semibold text-foreground">Trip Assignment</h2>
      </div>

      {currentTripId ? (
        /* Assigned state */
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex flex-col gap-1">
              <Link
                href={`/trips/${currentTripId}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                {currentTripNumber ?? 'Trip'}
                <ExternalLink className="h-3 w-3" />
              </Link>
              {currentTripStatus && (
                <span className="text-xs text-muted-foreground">
                  {TRIP_STATUS_LABELS[currentTripStatus]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Reassign (Change Trip) */}
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    Change Trip
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="end">
                  <TripSearchList
                    inputRef={inputRef}
                    search={search}
                    onSearchChange={setSearch}
                    trips={assignableTrips}
                    loading={tripsLoading}
                    onSelect={handleAssign}
                  />
                </PopoverContent>
              </Popover>

              {/* Remove from Trip */}
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700"
                onClick={() => setRemoveDialogOpen(true)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Unassigned state */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Not assigned to a trip.</p>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Truck className="mr-1.5 h-3.5 w-3.5" />
                Assign to Trip
                <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start">
              <TripSearchList
                inputRef={inputRef}
                search={search}
                onSearchChange={setSearch}
                trips={assignableTrips}
                loading={tripsLoading}
                onSelect={handleAssign}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        title="Remove from Trip"
        description={`Remove this order from ${currentTripNumber ?? 'the trip'}? The order status will be reset to "New" and the trip's financials will be recalculated.`}
        confirmLabel="Remove"
        destructive
        onConfirm={handleUnassign}
      />
    </div>
  )
}

/* ---- Trip Search List (shared between assign & reassign popovers) ---- */

function TripSearchList({
  inputRef,
  search,
  onSearchChange,
  trips,
  loading,
  onSelect,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  search: string
  onSearchChange: (value: string) => void
  trips: TripWithRelations[]
  loading: boolean
  onSelect: (tripId: string) => void
}) {
  return (
    <div className="flex flex-col">
      <div className="border-b p-2">
        <Input
          ref={inputRef}
          placeholder="Search by trip #, driver, or truck..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : trips.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {search ? 'No matching trips found.' : 'No assignable trips.'}
          </div>
        ) : (
          trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
              onClick={() => onSelect(trip.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {trip.trip_number ?? 'No #'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {buildTripLabel(trip)}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground/60">
                {trip.order_count} order{trip.order_count !== 1 ? 's' : ''}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
