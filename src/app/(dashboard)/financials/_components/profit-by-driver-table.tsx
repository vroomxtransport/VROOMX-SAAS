'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ProfitByDriver } from '@/lib/queries/financials'
import { DRIVER_TYPE_LABELS } from '@/types'
import type { DriverType } from '@/types'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { ExcelExportButton } from '@/components/shared/excel-export-button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { SortConfig } from '@/types/filters'
import Link from 'next/link'

interface ProfitByDriverTableProps {
  data: ProfitByDriver[]
}

function marginBadge(margin: number) {
  if (margin >= 20) {
    return {
      bg: 'bg-emerald-100 text-emerald-700',
    }
  }
  if (margin >= 10) {
    return {
      bg: 'bg-amber-100 text-amber-700',
    }
  }
  return {
    bg: 'bg-red-100 text-red-700',
  }
}

const PAY_TYPE_STYLES: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  owner_operator: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
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

  // Max revenue for profit bar scaling (use revenue as proxy since driver table has no profit column)
  const maxRevenue = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((d) => d.revenue), 1)
  }, [sorted])

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

  // Excel export handler — raw numbers so Excel can apply its own format codes
  const handleExcelExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return sorted.map((driver) => ({
      name: driver.name,
      driverType: DRIVER_TYPE_LABELS[driver.driverType as DriverType] ?? driver.driverType,
      tripCount: driver.tripCount,
      revenue: driver.revenue,
      driverPay: driver.driverPay,
      profitMargin: driver.profitMargin, // percent format divides by 100 inside util
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Profit by Driver
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">No trip data for this period</p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Profit by Driver
        </h3>
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
          <ExcelExportButton
            filename="profit-by-driver"
            sheetName="Profit by Driver"
            columns={[
              { key: 'name', header: 'Driver', format: 'text', width: 20 },
              { key: 'driverType', header: 'Type', format: 'text', width: 16 },
              { key: 'tripCount', header: 'Trips', format: 'number', width: 8 },
              { key: 'revenue', header: 'Revenue', format: 'currency', width: 14 },
              { key: 'driverPay', header: 'Driver Pay', format: 'currency', width: 14 },
              { key: 'profitMargin', header: 'Margin %', format: 'percent', width: 10 },
            ]}
            fetchData={handleExcelExport}
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
              {sorted.map((driver) => {
                const revenueBarWidth = Math.min((driver.revenue / maxRevenue) * 100, 100)
                const badge = marginBadge(driver.profitMargin)
                const payTypeStyle = PAY_TYPE_STYLES[driver.driverType] ??
                  'bg-gray-100 text-gray-700 ring-1 ring-gray-200'

                return (
                  <tr key={driver.driverId} className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-3">
                      <Link href="/drivers" className="font-medium text-brand hover:underline transition-colors">
                        {driver.name}
                      </Link>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                        payTypeStyle
                      )}>
                        {DRIVER_TYPE_LABELS[driver.driverType as DriverType] ?? driver.driverType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {driver.tripCount}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="relative flex items-center justify-end">
                        <div
                          className="absolute inset-y-0 right-0 rounded-sm bg-emerald-500/20"
                          style={{ width: `${revenueBarWidth}%` }}
                        />
                        <span className="relative tabular-nums text-foreground">
                          ${driver.revenue.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      ${driver.driverPay.toLocaleString()}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', badge.bg)}>
                        {driver.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
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
