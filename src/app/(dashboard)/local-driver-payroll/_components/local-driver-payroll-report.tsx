'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchLocalRuns } from '@/lib/queries/local-runs'
import { fetchDriverOptions } from '@/lib/queries/drivers'
import { useTerminals } from '@/hooks/use-terminals'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  LOCAL_RUN_STATUS_LABELS,
  LOCAL_RUN_STATUS_COLORS,
  LOCAL_DRIVE_TYPE_LABELS,
} from '@/types'
import type { LocalRunStatus, LocalDriveType } from '@/types'

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

const PAGE_SIZE = 25

export function LocalDriverPayrollReport() {
  const supabase = createClient()

  const [driverId, setDriverId] = useState('')
  const [terminalId, setTerminalId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const { data: driverOptions = [] } = useQuery({
    queryKey: ['driver-options-local'],
    queryFn: () => fetchDriverOptions(supabase),
    staleTime: 60_000,
  })

  const { data: terminals } = useTerminals({ activeOnly: true })

  // Only show local drivers in the dropdown
  const localDrivers = useMemo(
    () => driverOptions.filter((d) => d.driver_type === 'local_driver'),
    [driverOptions]
  )

  const { data, isLoading } = useQuery({
    queryKey: ['local-driver-payroll', driverId, terminalId, dateFrom, dateTo, page],
    queryFn: () =>
      fetchLocalRuns(supabase, {
        driverId: driverId || undefined,
        terminalId: terminalId || undefined,
        status: 'completed',
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    staleTime: 30_000,
  })

  const runs = data?.localRuns ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Aggregate totals
  const totalEarnings = runs.reduce((sum, r) => sum + parseFloat(r.total_expense || '0'), 0)
  const totalDrives = runs.reduce((sum, r) => {
    const drives = r.local_drives as Array<unknown> | undefined
    return sum + (drives?.length ?? 0)
  }, 0)

  const handleClearFilters = useCallback(() => {
    setDriverId('')
    setTerminalId('')
    setDateFrom('')
    setDateTo('')
    setPage(0)
  }, [])

  const handleExportCsv = useCallback(() => {
    if (runs.length === 0) return

    const headers = ['Driver', 'Terminal', 'Type', 'Date', 'Drives', 'Pay', 'Status']
    const rows = runs.map((run) => {
      const driverName = run.driver
        ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}`
        : 'Unassigned'
      const terminalName = (run.terminal as { name: string } | null)?.name ?? '--'
      const driveCount = (run.local_drives as Array<unknown> | undefined)?.length ?? 0
      return [
        driverName,
        terminalName,
        LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType] ?? run.type,
        run.scheduled_date ?? '',
        driveCount,
        parseFloat(run.total_expense || '0').toFixed(2),
        run.status,
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `local-driver-payroll-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [runs])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="widget-card !p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Driver</Label>
            <Select value={driverId} onValueChange={(v) => { setDriverId(v === 'all' ? '' : v); setPage(0) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Local Drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Local Drivers</SelectItem>
                {localDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {terminals && terminals.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Terminal</Label>
              <Select value={terminalId} onValueChange={(v) => { setTerminalId(v === 'all' ? '' : v); setPage(0) }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Terminals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terminals</SelectItem>
                  {terminals.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} className="w-[150px]" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} className="w-[150px]" />
          </div>

          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear
          </Button>

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={runs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="widget-card !p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">Total Paid</p>
          <p className="mt-1 text-2xl font-bold text-green-700">{formatCurrency(totalEarnings)}</p>
        </div>
        <div className="widget-card !p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">Completed Runs</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{total}</p>
        </div>
        <div className="widget-card !p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">Drives Completed</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{totalDrives}</p>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[48px] rounded-lg" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="widget-card flex items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No completed local runs found for the selected filters.
          </p>
        </div>
      ) : (
        <div className="widget-card !p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
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
                const driverName = run.driver
                  ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}`
                  : 'Unassigned'
                const terminalName = (run.terminal as { name: string } | null)?.name ?? '--'
                const driveCount = (run.local_drives as Array<unknown> | undefined)?.length ?? 0

                return (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{driverName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{terminalName}</TableCell>
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
                      <Badge variant="outline" className={LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus] ?? ''}>
                        {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus] ?? run.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
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
        </div>
      )}
    </div>
  )
}
