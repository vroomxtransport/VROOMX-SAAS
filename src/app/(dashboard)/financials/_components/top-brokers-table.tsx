'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { TopBroker } from '@/lib/queries/financials'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { SortConfig } from '@/types/filters'

interface TopBrokersTableProps {
  data: TopBroker[]
}

export function TopBrokersTable({ data }: TopBrokersTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  // Client-side search filter (debounced via controlled input)
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((broker) =>
      broker.brokerName.toLowerCase().includes(q)
    )
  }, [data, search])

  // Client-side sort
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof TopBroker]
      const bVal = b[field as keyof TopBroker]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [filtered, sort])

  // Max revenue for bar scaling
  const maxRevenue = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((b) => b.totalRevenue), 1)
  }, [sorted])

  // CSV export handler
  const handleCsvExport = useCallback(async () => {
    return sorted.map((broker) => ({
      brokerName: broker.brokerName,
      orderCount: String(broker.orderCount),
      totalRevenue: broker.totalRevenue.toFixed(2),
      avgOrderValue: broker.avgOrderValue.toFixed(2),
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Top Brokers by Revenue
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">No broker data available</p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Top Brokers by Revenue
        </h3>
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search broker..."
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
            filename="top-brokers"
            headers={['brokerName', 'orderCount', 'totalRevenue', 'avgOrderValue']}
            fetchData={handleCsvExport}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No brokers match &quot;{search}&quot;
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Broker</th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Orders"
                    field="orderCount"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Revenue"
                    field="totalRevenue"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortHeader
                    label="Avg Value"
                    field="avgOrderValue"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((broker, index) => {
                const revenueBarWidth = Math.min((broker.totalRevenue / maxRevenue) * 100, 100)
                const rank = index + 1
                const isTopThree = rank <= 3

                return (
                  <tr key={broker.brokerName} className="border-b border-border-subtle/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-2">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                          isTopThree
                            ? 'bg-brand/10 text-brand dark:bg-brand/20'
                            : 'text-muted-foreground'
                        )}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-medium text-foreground">
                        {broker.brokerName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                      {broker.orderCount}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="relative flex items-center justify-end">
                        <div
                          className="absolute inset-y-0 right-0 rounded-sm bg-brand/10"
                          style={{ width: `${revenueBarWidth}%` }}
                        />
                        <span className="relative tabular-nums font-medium text-foreground">
                          ${broker.totalRevenue.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                      ${broker.avgOrderValue.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground text-right">
              Showing {sorted.length} broker{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
