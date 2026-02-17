'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTrips } from '@/lib/queries/trips'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, ChevronLeft, ChevronRight } from 'lucide-react'
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from '@/types'
import type { TripStatus } from '@/types'

interface DriverEarningsProps {
  driverId: string
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const PAGE_SIZE = 20

export function DriverEarnings({ driverId }: DriverEarningsProps) {
  const supabase = createClient()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['driver-trips', driverId, page],
    queryFn: () =>
      fetchTrips(supabase, {
        driverId,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
  })

  const trips = data?.trips ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Calculate summary from all fetched trips (completed only for earnings)
  const completedTrips = trips.filter((t) => t.status === 'completed')
  const totalEarnings = completedTrips.reduce(
    (sum, t) => sum + parseFloat(t.driver_pay),
    0
  )
  const totalTrips = completedTrips.length
  const avgPerTrip = totalTrips > 0 ? totalEarnings / totalTrips : 0

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <DollarSign className="h-4 w-4" />
          Earnings
        </h3>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-surface p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <DollarSign className="h-4 w-4" />
        Earnings
      </h3>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-center">
          <p className="text-xs font-medium text-green-600">Total Earnings</p>
          <p className="mt-1 text-lg font-bold text-green-800 dark:text-green-400">
            {formatCurrency(totalEarnings)}
          </p>
        </div>
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
          <p className="text-xs font-medium text-blue-600">Completed Trips</p>
          <p className="mt-1 text-lg font-bold text-blue-800 dark:text-blue-400">{totalTrips}</p>
        </div>
        <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 p-3 text-center">
          <p className="text-xs font-medium text-purple-600">Avg Per Trip</p>
          <p className="mt-1 text-lg font-bold text-purple-800 dark:text-purple-400">
            {formatCurrency(avgPerTrip)}
          </p>
        </div>
      </div>

      {/* Earnings table */}
      {trips.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No completed trips yet
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trip #</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Driver Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell className="font-medium">
                    {trip.trip_number ?? '--'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {trip.order_count}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(trip.total_revenue)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(trip.driver_pay)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        TRIP_STATUS_COLORS[trip.status as TripStatus] ?? ''
                      }
                    >
                      {TRIP_STATUS_LABELS[trip.status as TripStatus] ??
                        trip.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({total} trips)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
