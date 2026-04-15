'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { ProfitByTruck } from '@/lib/queries/financials'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { ExcelExportButton } from '@/components/shared/excel-export-button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { SortConfig } from '@/types/filters'
import Link from 'next/link'

interface ProfitByTruckTableProps {
  data: ProfitByTruck[]
}

function marginBadge(margin: number) {
  if (margin >= 20) {
    return {
      bg: 'text-emerald-700',
    }
  }
  if (margin >= 10) {
    return {
      bg: 'text-amber-700',
    }
  }
  return {
    bg: 'text-red-700',
  }
}

export function ProfitByTruckTable({ data }: ProfitByTruckTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((truck) =>
      truck.unitNumber.toLowerCase().includes(q)
    )
  }, [data, search])

  // Client-side sort
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof ProfitByTruck]
      const bVal = b[field as keyof ProfitByTruck]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [filtered, sort])

  // Max profit for bar scaling
  const maxAbsProfit = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((t) => Math.abs(t.profit)), 1)
  }, [sorted])

  // CSV export handler
  const handleCsvExport = useCallback(async () => {
    return sorted.map((truck) => ({
      unitNumber: truck.unitNumber,
      revenue: truck.revenue.toFixed(2),
      expenses: truck.expenses.toFixed(2),
      profit: truck.profit.toFixed(2),
      margin: `${truck.margin.toFixed(1)}%`,
      tripCount: String(truck.tripCount),
    }))
  }, [sorted])

  // Excel export handler — raw numbers so Excel can apply its own format codes
  const handleExcelExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return sorted.map((truck) => ({
      unitNumber: truck.unitNumber,
      revenue: truck.revenue,
      expenses: truck.expenses,
      profit: truck.profit,
      margin: truck.margin,   // passed as plain number; percent format divides by 100 inside util
      tripCount: truck.tripCount,
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Profit by Truck
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
          Profit by Truck
        </h3>
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search truck..."
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
            filename="profit-by-truck"
            headers={['unitNumber', 'revenue', 'expenses', 'profit', 'margin', 'tripCount']}
            fetchData={handleCsvExport}
            className="h-8 text-xs"
          />
          <ExcelExportButton
            filename="profit-by-truck"
            sheetName="Profit by Truck"
            columns={[
              { key: 'unitNumber', header: 'Unit #', format: 'text', width: 12 },
              { key: 'revenue', header: 'Revenue', format: 'currency', width: 14 },
              { key: 'expenses', header: 'Expenses', format: 'currency', width: 14 },
              { key: 'profit', header: 'Profit', format: 'currency', width: 14 },
              { key: 'margin', header: 'Margin %', format: 'percent', width: 10 },
              { key: 'tripCount', header: 'Trips', format: 'number', width: 8 },
            ]}
            fetchData={handleExcelExport}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No trucks match &quot;{search}&quot;
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Truck</th>
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
                    label="Expenses"
                    field="expenses"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Profit"
                    field="profit"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Margin"
                    field="margin"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">Trips</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((truck) => {
                const profitBarWidth = Math.min((Math.abs(truck.profit) / maxAbsProfit) * 100, 100)
                const badge = marginBadge(truck.margin)

                return (
                  <tr key={truck.truckId} className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/trucks/${truck.truckId}/financials`}
                        className="font-medium text-brand hover:underline transition-colors"
                      >
                        {truck.unitNumber}
                      </Link>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-foreground">
                      ${truck.revenue.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      ${truck.expenses.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="relative flex items-center justify-end">
                        <div
                          className={cn(
                            'absolute inset-y-0 right-0 rounded-sm',
                            truck.profit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          )}
                          style={{ width: `${profitBarWidth}%` }}
                        />
                        <span className="relative tabular-nums font-medium text-foreground">
                          ${truck.profit.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', badge.bg)}>
                        {truck.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                      {truck.tripCount}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground text-right">
              Showing {sorted.length} truck{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
