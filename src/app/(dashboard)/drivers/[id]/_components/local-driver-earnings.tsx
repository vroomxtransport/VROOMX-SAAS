'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchLocalRuns } from '@/lib/queries/local-runs'
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
import { Navigation, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  LOCAL_RUN_STATUS_LABELS,
  LOCAL_RUN_STATUS_COLORS,
  LOCAL_DRIVE_TYPE_LABELS,
} from '@/types'
import type { LocalRunStatus, LocalDriveType } from '@/types'

interface LocalDriverEarningsProps {
  driverId: string
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const PAGE_SIZE = 20

export function LocalDriverEarnings({ driverId }: LocalDriverEarningsProps) {
  const supabase = createClient()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['local-driver-runs', driverId, page],
    queryFn: () =>
      fetchLocalRuns(supabase, {
        driverId,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
  })

  const runs = data?.localRuns ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Summary from completed runs
  const completedRuns = runs.filter((r) => r.status === 'completed')
  const totalEarnings = completedRuns.reduce(
    (sum, r) => sum + parseFloat(r.total_expense || '0'),
    0
  )
  const completedCount = completedRuns.length

  // Count drives across completed runs
  const totalDrives = completedRuns.reduce((sum, r) => {
    const drives = r.local_drives as Array<unknown> | undefined
    return sum + (drives?.length ?? 0)
  }, 0)

  const avgPerRun = completedCount > 0 ? totalEarnings / completedCount : 0

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-surface p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Navigation className="h-4 w-4" />
          Local Operations Earnings
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
        <Navigation className="h-4 w-4" />
        Local Operations Earnings
      </h3>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <div className="rounded-md bg-green-50 p-3 text-center">
          <p className="text-xs font-medium text-green-600">Total Earnings</p>
          <p className="mt-1 text-lg font-bold text-green-800">
            {formatCurrency(totalEarnings)}
          </p>
        </div>
        <div className="rounded-md bg-blue-50 p-3 text-center">
          <p className="text-xs font-medium text-blue-600">Completed Runs</p>
          <p className="mt-1 text-lg font-bold text-blue-800">{completedCount}</p>
        </div>
        <div className="rounded-md bg-indigo-50 p-3 text-center">
          <p className="text-xs font-medium text-indigo-600">Total Drives</p>
          <p className="mt-1 text-lg font-bold text-indigo-800">{totalDrives}</p>
        </div>
        <div className="rounded-md bg-purple-50 p-3 text-center">
          <p className="text-xs font-medium text-purple-600">Avg Per Run</p>
          <p className="mt-1 text-lg font-bold text-purple-800">
            {formatCurrency(avgPerRun)}
          </p>
        </div>
      </div>

      {/* Runs table */}
      {runs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground/60">
          No local runs assigned yet
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Terminal</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Drives</TableHead>
                <TableHead className="text-right">Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const terminalName = (run.terminal as { name: string } | null)?.name ?? '--'
                const driveCount = (run.local_drives as Array<unknown> | undefined)?.length ?? 0

                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{terminalName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType] ?? run.type}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(run.scheduled_date)}
                    </TableCell>
                    <TableCell className="text-right text-sm">{driveCount}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(run.total_expense)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus] ?? ''}
                      >
                        {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus] ?? run.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({total} runs)
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
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
