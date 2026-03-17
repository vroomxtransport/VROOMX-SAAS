'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ProfitByDriver } from '@/lib/queries/financials'
import { DRIVER_TYPE_LABELS } from '@/types'
import type { DriverType } from '@/types'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { SortConfig } from '@/types/filters'
import Link from 'next/link'

interface ProfitByDriverTableProps {
  data: ProfitByDriver[]
}

function marginColor(margin: number): string {
  if (margin >= 10) return 'text-emerald-600'
  if (margin >= 5) return 'text-amber-600'
  return 'text-red-600'
}

export function ProfitByDriverTable({ data }: ProfitByDriverTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((driver) =>
      driver.name.toLowerCase().includes(q)
    )
  }, [data, search])

  // Client-side sort
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof ProfitByDriver]
      const bVal = b[field as keyof ProfitByDriver]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [filtered, sort])

  // CSV export handler
  const handleCsvExport = useCallback(async () => {
    return sorted.map((driver) => ({
      name: driver.name,
      driverType: DRIVER_TYPE_LABELS[driver.driverType as DriverType] ?? driver.driverType,
      tripCount: String(driver.tripCount),
      revenue: driver.revenue.toFixed(2),
      driverPay: driver.driverPay.toFixed(2),
      profitMargin: `${driver.profitMargin.toFixed(1)}%`,
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <h3 className="text-base font-semibold text-foreground mb-3">Profit by Driver</h3>
        <p className="text-sm text-muted-foreground py-8 text-center">No trip data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-foreground">Profit by Driver</h3>
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[160px] pl-8 text-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <CsvExportButton
            filename="profit-by-driver"
            headers={['name', 'driverType', 'tripCount', 'revenue', 'driverPay', 'profitMargin']}
            fetchData={handleCsvExport}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No drivers match &quot;{search}&quot;
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Driver</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Trips"
                    field="tripCount"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Revenue"
                    field="revenue"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Driver Pay"
                    field="driverPay"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortHeader
                    label="Margin"
                    field="profitMargin"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((driver) => (
                <tr key={driver.driverId} className="border-b border-border-subtle/50 last:border-0">
                  <td className="py-2 pr-3">
                    <Link href={`/drivers`} className="font-medium text-foreground hover:text-brand transition-colors">
                      {driver.name}
                    </Link>
                  </td>
                  <td className="py-2 px-3">
                    <span className={cn(
                      'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                      driver.driverType === 'company'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                        : 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                    )}>
                      {DRIVER_TYPE_LABELS[driver.driverType as DriverType] ?? driver.driverType}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {driver.tripCount}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-foreground">
                    ${driver.revenue.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    ${driver.driverPay.toLocaleString()}
                  </td>
                  <td className={cn('py-2 pl-3 text-right tabular-nums font-medium', marginColor(driver.profitMargin))}>
                    {driver.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground text-right">
              Showing {sorted.length} driver{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
