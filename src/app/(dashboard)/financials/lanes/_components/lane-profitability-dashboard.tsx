'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { DateRange, SortConfig } from '@/types/filters'
import { fetchLaneProfitability, computeLaneSummary } from '@/lib/queries/lane-analytics'
import type { LaneProfitability } from '@/lib/queries/lane-analytics'
import { PeriodSelector } from '../../_components/period-selector'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import { Search, X, TrendingUp, TrendingDown, MapPin, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

// ============================================================================
// Helpers
// ============================================================================

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function fmtCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function marginBadge(margin: number) {
  if (margin >= 20) return 'text-emerald-700'
  if (margin >= 10) return 'text-amber-700'
  if (margin >= 0) return 'text-yellow-700'
  return 'text-red-700'
}

// ============================================================================
// Summary Cards
// ============================================================================

function LaneSummaryCards({ lanes }: { lanes: LaneProfitability[] }) {
  const summary = useMemo(() => computeLaneSummary(lanes), [lanes])

  const cards = [
    {
      label: 'Total Lanes',
      value: String(summary.totalLanes),
      sub: `${summary.profitableLanes} profitable`,
      accent: 'bg-brand',
    },
    {
      label: 'Total Revenue',
      value: fmtCurrency(summary.totalRevenue),
      sub: `${summary.totalLoads} loads`,
      accent: 'bg-blue-500',
    },
    {
      label: 'Total Profit',
      value: fmtCurrency(summary.totalProfit),
      sub: summary.totalProfit >= 0 ? 'Net positive' : 'Net negative',
      accent: summary.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500',
    },
    {
      label: 'Avg Margin',
      value: `${summary.avgMargin.toFixed(1)}%`,
      sub: `${summary.unprofitableLanes} lanes losing money`,
      accent: summary.avgMargin >= 15 ? 'bg-emerald-500' : summary.avgMargin >= 0 ? 'bg-amber-500' : 'bg-red-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="widget-card">
          <div className="flex items-start gap-3">
            <div className={cn('w-1 h-10 rounded-full', card.accent)} />
            <div>
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="text-xl font-semibold tabular-nums text-foreground mt-0.5">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Top/Bottom Lanes Chart
// ============================================================================

function LaneProfitChart({ lanes }: { lanes: LaneProfitability[] }) {
  // Show top 5 + bottom 5 lanes by profit
  const chartData = useMemo(() => {
    if (lanes.length === 0) return []

    const sorted = [...lanes].sort((a, b) => b.profit - a.profit)
    const top5 = sorted.slice(0, 5)
    const bottom5 = sorted.slice(-5).reverse()

    // Deduplicate if total lanes < 10
    const seen = new Set<string>()
    const combined: { lane: string; profit: number; margin: number }[] = []

    for (const l of top5) {
      if (!seen.has(l.lane)) {
        seen.add(l.lane)
        combined.push({ lane: l.lane, profit: l.profit, margin: l.margin })
      }
    }
    for (const l of bottom5) {
      if (!seen.has(l.lane)) {
        seen.add(l.lane)
        combined.push({ lane: l.lane, profit: l.profit, margin: l.margin })
      }
    }

    return combined.sort((a, b) => b.profit - a.profit)
  }, [lanes])

  if (chartData.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Top &amp; Bottom Lanes
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">No lane data available</p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Top &amp; Bottom Lanes by Profit
        </h3>
      </div>
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="profitGreen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="profitRed" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#f87171" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => fmtCurrency(v)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="lane"
              width={100}
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { lane: string; profit: number; margin: number }
                return (
                  <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
                    <p className="text-xs font-medium text-foreground mb-1">{d.lane}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      Profit: {fmtCurrencyFull(d.profit)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Margin: {d.margin.toFixed(1)}%
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="profit" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.profit >= 0 ? 'url(#profitGreen)' : 'url(#profitRed)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ============================================================================
// Lane Table
// ============================================================================

function LaneTable({ lanes }: { lanes: LaneProfitability[] }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  const filtered = useMemo(() => {
    if (!search.trim()) return lanes
    const q = search.toLowerCase().trim()
    return lanes.filter((lane) =>
      lane.lane.toLowerCase().includes(q) ||
      lane.pickupState.toLowerCase().includes(q) ||
      lane.deliveryState.toLowerCase().includes(q)
    )
  }, [lanes, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof LaneProfitability]
      const bVal = b[field as keyof LaneProfitability]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal ?? '').localeCompare(String(bVal ?? '')) * mult
    })
  }, [filtered, sort])

  const maxAbsProfit = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((l) => Math.abs(l.profit)), 1)
  }, [sorted])

  const handleCsvExport = useCallback(async () => {
    return sorted.map((lane) => ({
      lane: lane.lane,
      loadCount: String(lane.loadCount),
      revenue: lane.revenue.toFixed(2),
      cleanGross: lane.cleanGross.toFixed(2),
      profit: lane.profit.toFixed(2),
      margin: `${lane.margin.toFixed(1)}%`,
      avgRevenue: lane.avgRevenue.toFixed(2),
      avgProfit: lane.avgProfit.toFixed(2),
      totalMiles: lane.totalMiles.toFixed(1),
      rpm: lane.rpm !== null ? `$${lane.rpm.toFixed(2)}` : 'N/A',
      ppm: lane.ppm !== null ? `$${lane.ppm.toFixed(2)}` : 'N/A',
    }))
  }, [sorted])

  if (lanes.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Lane Profitability
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">No order data for this period</p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Lane Profitability
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search lane..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[180px] pl-8 text-xs"
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
            filename="lane-profitability"
            headers={['lane', 'loadCount', 'revenue', 'cleanGross', 'profit', 'margin', 'avgRevenue', 'avgProfit', 'totalMiles', 'rpm', 'ppm']}
            fetchData={handleCsvExport}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No lanes match &quot;{search}&quot;
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Lane</th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Loads" field="loadCount" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Revenue" field="revenue" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Clean Gross" field="cleanGross" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Profit" field="profit" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Margin" field="margin" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="Avg/Load" field="avgProfit" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader label="RPM" field="rpm" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortHeader label="Miles" field="totalMiles" currentSort={sort} onSort={setSort} className="justify-end" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((lane) => {
                const profitBarWidth = Math.min((Math.abs(lane.profit) / maxAbsProfit) * 100, 100)

                return (
                  <tr key={lane.lane} className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{lane.pickupState}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{lane.deliveryState}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {lane.loadCount}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                      {fmtCurrency(lane.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                      {fmtCurrency(lane.cleanGross)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="relative flex items-center justify-end">
                        <div
                          className={cn(
                            'absolute inset-y-0 right-0 rounded-sm',
                            lane.profit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          )}
                          style={{ width: `${profitBarWidth}%` }}
                        />
                        <span className={cn(
                          'relative tabular-nums font-medium',
                          lane.profit >= 0 ? 'text-foreground' : 'text-red-600'
                        )}>
                          {fmtCurrency(lane.profit)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', marginBadge(lane.margin))}>
                        {lane.margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {fmtCurrency(lane.avgProfit)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                      {lane.rpm !== null ? `$${lane.rpm.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                      {lane.totalMiles > 0 ? lane.totalMiles.toLocaleString() : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground text-right">
              Showing {sorted.length} lane{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Dashboard
// ============================================================================

interface LaneProfitabilityDashboardProps {
  initialLanes: LaneProfitability[]
}

export function LaneProfitabilityDashboard({ initialLanes }: LaneProfitabilityDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const supabase = createClient()

  const { data: lanes } = useQuery({
    queryKey: ['financials', 'lanes', dateRange?.from, dateRange?.to],
    queryFn: () => fetchLaneProfitability(supabase, dateRange),
    initialData: dateRange === undefined ? initialLanes : undefined,
    staleTime: 60_000,
  })

  const currentLanes = lanes ?? initialLanes

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lane Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Profitability by origin → destination route
          </p>
        </div>
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary KPI cards */}
      <LaneSummaryCards lanes={currentLanes} />

      {/* Chart + Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LaneProfitChart lanes={currentLanes} />
        <div className="widget-card p-0">
          {/* Top profitable & unprofitable lanes mini-lists */}
          <div className="grid grid-cols-2 divide-x divide-border-subtle">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-medium text-foreground">Best Lanes</h4>
              </div>
              <div className="space-y-2">
                {currentLanes.filter(l => l.profit > 0).slice(0, 5).map((lane) => (
                  <div key={lane.lane} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{lane.lane}</span>
                    <span className="tabular-nums font-medium text-emerald-600 whitespace-nowrap">
                      {fmtCurrency(lane.profit)}
                    </span>
                  </div>
                ))}
                {currentLanes.filter(l => l.profit > 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">No profitable lanes</p>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-medium text-foreground">Worst Lanes</h4>
              </div>
              <div className="space-y-2">
                {[...currentLanes].sort((a, b) => a.profit - b.profit).filter(l => l.profit <= 0).slice(0, 5).map((lane) => (
                  <div key={lane.lane} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate mr-2">{lane.lane}</span>
                    <span className="tabular-nums font-medium text-red-600 whitespace-nowrap">
                      {fmtCurrency(lane.profit)}
                    </span>
                  </div>
                ))}
                {currentLanes.filter(l => l.profit <= 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">All lanes are profitable</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full lane table */}
      <LaneTable lanes={currentLanes} />
    </div>
  )
}
