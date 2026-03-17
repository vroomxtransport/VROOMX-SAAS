'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDispatcherPerformance } from '@/lib/queries/dispatcher-performance'
import type { DispatcherPerformance } from '@/lib/queries/dispatcher-performance'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { SortHeader } from '@/components/shared/sort-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { TrendingUp } from 'lucide-react'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  admin: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
  dispatcher: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
}

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Dispatcher name...',
  },
  {
    key: 'dateRange',
    label: 'Period',
    type: 'date-range',
  },
]

function sortPerformers(
  data: DispatcherPerformance[],
  sort: SortConfig | undefined
): DispatcherPerformance[] {
  if (!sort) return data

  const sorted = [...data]
  const { field, direction } = sort
  const multiplier = direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    const aVal = a[field as keyof DispatcherPerformance]
    const bVal = b[field as keyof DispatcherPerformance]

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier
    }
    return 0
  })

  return sorted
}

export function PerformanceTable() {
  const supabase = createClient()

  const { data: performers, isLoading } = useQuery({
    queryKey: ['dispatcher-performance'],
    queryFn: () => fetchDispatcherPerformance(supabase),
    staleTime: 30_000,
  })

  const [search, setSearch] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.search = search
    if (dateRange) filters.dateRange = dateRange
    return filters
  }, [search, dateRange])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      if (key === 'search') {
        setSearch(value as string | undefined)
      } else if (key === 'dateRange') {
        setDateRange(value as DateRange | undefined)
      }
    },
    []
  )

  const handleSort = useCallback((newSort: SortConfig | undefined) => {
    setSort(newSort)
  }, [])

  const filtered = useMemo(() => {
    if (!performers) return []
    let result = [...performers]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }

    // Note: dateRange filtering would require order-level date data from the query.
    // Currently the performance query aggregates all orders without date filtering.
    // The date range filter is wired up for future enhancement when the query
    // supports a date parameter. For now it serves as a UI placeholder that
    // will be connected once fetchDispatcherPerformance accepts date bounds.

    return sortPerformers(result, sort)
  }, [performers, search, sort])

  const handleCsvExport = useCallback(async () => {
    return filtered.map((p) => ({
      name: p.name,
      role: p.role,
      total_orders: p.total_orders,
      completed_orders: p.completed_orders,
      total_revenue: p.total_revenue,
      completion_rate:
        p.total_orders > 0
          ? `${Math.round((p.completed_orders / p.total_orders) * 100)}%`
          : '0%',
    }))
  }, [filtered])

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-9 w-[300px]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!performers || performers.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No performance data"
        description="Performance metrics will appear once dispatchers are active and orders are assigned."
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={filtered.length}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="dispatcher-performance"
            headers={['name', 'role', 'total_orders', 'completed_orders', 'total_revenue', 'completion_rate']}
            fetchData={handleCsvExport}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No matching results"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-accent/50">
                <th className="px-4 py-3 text-left">
                  <SortHeader
                    label="Name"
                    field="name"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Orders"
                    field="total_orders"
                    currentSort={sort}
                    onSort={handleSort}
                    className="justify-end"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Completed"
                    field="completed_orders"
                    currentSort={sort}
                    onSort={handleSort}
                    className="justify-end"
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Revenue"
                    field="total_revenue"
                    currentSort={sort}
                    onSort={handleSort}
                    className="justify-end"
                  />
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Completion %
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const roleColor = ROLE_COLORS[p.role] ?? 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                const completionRate =
                  p.total_orders > 0
                    ? Math.round((p.completed_orders / p.total_orders) * 100)
                    : 0

                return (
                  <tr
                    key={p.user_id}
                    className="border-b border-border-subtle last:border-0 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={roleColor}>
                        {p.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {p.total_orders}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      {p.completed_orders}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground tabular-nums">
                      ${p.total_revenue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          completionRate >= 80
                            ? 'text-emerald-500'
                            : completionRate >= 50
                              ? 'text-amber-500'
                              : 'text-muted-foreground'
                        }
                      >
                        {completionRate}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
