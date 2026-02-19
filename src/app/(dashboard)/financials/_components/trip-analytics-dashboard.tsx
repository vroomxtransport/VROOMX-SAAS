'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { FinancialPeriod, TripAnalyticsRow } from '@/lib/queries/financials'
import { fetchTripAnalytics } from '@/lib/queries/financials'
import { PeriodSelector } from './period-selector'
import { StatusBadge } from '@/components/shared/status-badge'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import {
  Route,
  TrendingDown,
  TrendingUp,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface TripAnalyticsDashboardProps {
  initialTrips: TripAnalyticsRow[]
}

type SortField = 'startDate' | 'revenue' | 'netProfit' | 'totalMiles' | 'rpm' | 'cpm' | 'ppm' | 'appc' | 'orderCount'
type SortDir = 'asc' | 'desc'

function fmt$(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPerMile(val: number | null): string {
  if (val === null) return 'N/A'
  return `$${val.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function TripAnalyticsDashboard({ initialTrips }: TripAnalyticsDashboardProps) {
  const [period, setPeriod] = useState<FinancialPeriod>('mtd')
  const [sortField, setSortField] = useState<SortField>('startDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const supabase = createClient()

  const { data: trips } = useQuery({
    queryKey: ['financials', 'trip-analytics', period],
    queryFn: () => fetchTripAnalytics(supabase, period),
    initialData: period === 'mtd' ? initialTrips : undefined,
    staleTime: 60_000,
  })

  const data = trips ?? initialTrips

  // Compute summary averages
  const summary = useMemo(() => {
    const tripsWithMiles = data.filter((t) => t.totalMiles > 0)
    const totalMiles = tripsWithMiles.reduce((sum, t) => sum + t.totalMiles, 0)
    const totalRevenue = tripsWithMiles.reduce((sum, t) => sum + t.revenue, 0)
    const totalCosts = tripsWithMiles.reduce((sum, t) => sum + t.totalCosts, 0)
    const totalProfit = tripsWithMiles.reduce((sum, t) => sum + t.netProfit, 0)
    const totalOrders = data.reduce((sum, t) => sum + t.orderCount, 0)

    return {
      avgRpm: totalMiles > 0 ? totalRevenue / totalMiles : null,
      avgCpm: totalMiles > 0 ? totalCosts / totalMiles : null,
      avgPpm: totalMiles > 0 ? totalProfit / totalMiles : null,
      avgAppc: totalOrders > 0 ? data.reduce((s, t) => s + t.revenue, 0) / totalOrders : null,
      tripCount: data.length,
      totalMiles,
    }
  }, [data])

  // Sort data
  const sorted = useMemo(() => {
    const compareFn = (a: TripAnalyticsRow, b: TripAnalyticsRow) => {
      const getVal = (row: TripAnalyticsRow): number => {
        switch (sortField) {
          case 'startDate': return new Date(row.startDate).getTime()
          case 'revenue': return row.revenue
          case 'netProfit': return row.netProfit
          case 'totalMiles': return row.totalMiles
          case 'rpm': return row.rpm ?? -Infinity
          case 'cpm': return row.cpm ?? -Infinity
          case 'ppm': return row.ppm ?? -Infinity
          case 'appc': return row.appc ?? -Infinity
          case 'orderCount': return row.orderCount
        }
      }
      const diff = getVal(a) - getVal(b)
      return sortDir === 'asc' ? diff : -diff
    }
    return [...data].sort(compareFn)
  }, [data, sortField, sortDir])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-foreground" />
      : <ArrowDown className="h-3 w-3 text-foreground" />
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Avg RPM"
          value={summary.avgRpm !== null ? `$${summary.avgRpm.toFixed(2)}/mi` : 'N/A'}
          description="Revenue Per Mile"
          icon={Route}
          accent="blue"
        />
        <SummaryCard
          label="Avg CPM"
          value={summary.avgCpm !== null ? `$${summary.avgCpm.toFixed(2)}/mi` : 'N/A'}
          description="Cost Per Mile"
          icon={TrendingDown}
          accent="amber"
        />
        <SummaryCard
          label="Avg PPM"
          value={summary.avgPpm !== null ? `$${summary.avgPpm.toFixed(2)}/mi` : 'N/A'}
          description="Profit Per Mile"
          icon={TrendingUp}
          accent={summary.avgPpm !== null && summary.avgPpm >= 0 ? 'emerald' : 'rose'}
        />
        <SummaryCard
          label="Avg APPC"
          value={summary.avgAppc !== null ? fmt$(summary.avgAppc) : 'N/A'}
          description={`${summary.tripCount} trips`}
          icon={Package}
          accent="violet"
        />
      </div>

      {/* Trip Analytics Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 dark:bg-muted/10">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trip</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Driver</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">Truck</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                  <button onClick={() => handleSort('startDate')} className="flex items-center gap-1 hover:text-foreground">
                    Date {sortIcon('startDate')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('revenue')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    Revenue {sortIcon('revenue')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('netProfit')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    Profit {sortIcon('netProfit')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('totalMiles')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    Miles {sortIcon('totalMiles')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('rpm')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    RPM {sortIcon('rpm')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('cpm')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    CPM {sortIcon('cpm')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('ppm')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    PPM {sortIcon('ppm')}
                  </button>
                </th>
                <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                  <button onClick={() => handleSort('appc')} className="flex items-center gap-1 ml-auto hover:text-foreground">
                    APPC {sortIcon('appc')}
                  </button>
                </th>
                <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                  <button onClick={() => handleSort('orderCount')} className="flex items-center gap-1 mx-auto hover:text-foreground">
                    Orders {sortIcon('orderCount')}
                  </button>
                </th>
                <th className="px-3 py-3 text-center font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">
                    No trips found for this period.
                  </td>
                </tr>
              ) : (
                sorted.map((t) => (
                  <tr key={t.tripId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/trips/${t.tripId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {t.tripNumber ?? 'Draft'}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-foreground">{t.driverName}</td>
                    <td className="px-3 py-3 text-muted-foreground">{t.truckUnit}</td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(t.startDate)}</td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt$(t.revenue)}</td>
                    <td className={cn(
                      'px-3 py-3 text-right font-medium tabular-nums',
                      t.netProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    )}>
                      {fmt$(t.netProfit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {t.totalMiles > 0 ? t.totalMiles.toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtPerMile(t.rpm)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700 dark:text-amber-400">{fmtPerMile(t.cpm)}</td>
                    <td className={cn(
                      'px-3 py-3 text-right tabular-nums',
                      t.ppm !== null && t.ppm >= 0 ? 'text-green-700 dark:text-green-400' : t.ppm !== null ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'
                    )}>
                      {fmtPerMile(t.ppm)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.appc !== null ? fmt$(t.appc) : 'N/A'}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{t.orderCount}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={t.status} type="trip" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// --- Summary Card ---

const ACCENT_STYLES = {
  blue: 'border-blue-200/50 bg-blue-500/5 dark:border-blue-800/50 dark:bg-blue-500/10',
  emerald: 'border-emerald-200/50 bg-emerald-500/5 dark:border-emerald-800/50 dark:bg-emerald-500/10',
  amber: 'border-amber-200/50 bg-amber-500/5 dark:border-amber-800/50 dark:bg-amber-500/10',
  violet: 'border-violet-200/50 bg-violet-500/5 dark:border-violet-800/50 dark:bg-violet-500/10',
  rose: 'border-rose-200/50 bg-rose-500/5 dark:border-rose-800/50 dark:bg-rose-500/10',
}

const ICON_STYLES = {
  blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400',
  emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400',
  amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400',
  violet: 'text-violet-600 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-400',
  rose: 'text-rose-600 bg-rose-100 dark:bg-rose-900/50 dark:text-rose-400',
}

function SummaryCard({ label, value, description, icon: Icon, accent }: {
  label: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
}) {
  return (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', ACCENT_STYLES[accent])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground truncate">{value}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">{description}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}
