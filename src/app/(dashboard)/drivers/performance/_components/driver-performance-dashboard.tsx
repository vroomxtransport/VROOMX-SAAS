'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import {
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Search,
  X,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  fetchDriverPerformance,
  computeDriverSummary,
} from '@/lib/queries/driver-scorecard'
import type { DriverPerformance, DriverSummary } from '@/lib/queries/driver-scorecard'
import type { DateRange } from '@/types/filters'
import type { SortConfig } from '@/types/filters'
import { PeriodSelector } from '@/app/(dashboard)/financials/_components/period-selector'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'

// ============================================================================
// Props
// ============================================================================

interface DriverPerformanceDashboardProps {
  initialDrivers: DriverPerformance[]
  initialSummary: DriverSummary
}

// ============================================================================
// Formatting helpers
// ============================================================================

function fmt$(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`
}

function fmtPerMile(val: number | null): string {
  if (val === null) return '—'
  return `$${val.toFixed(2)}`
}

// ============================================================================
// Driver type badge
// ============================================================================

const DRIVER_TYPE_BADGE: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700',
  owner_operator: 'bg-violet-100 text-violet-700',
  local_driver: 'bg-slate-100 text-slate-700',
}

const DRIVER_TYPE_LABEL: Record<string, string> = {
  company: 'Company',
  owner_operator: 'Owner-Op',
  local_driver: 'Local',
}

function DriverTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
        DRIVER_TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-700'
      )}
    >
      {DRIVER_TYPE_LABEL[type] ?? type}
    </span>
  )
}

// ============================================================================
// Score badge
// ============================================================================

function scoreBadgeClass(score: number): string {
  if (score >= 75) return 'bg-emerald-100 text-emerald-700'
  if (score >= 50) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
        scoreBadgeClass(score)
      )}
    >
      {score}
    </span>
  )
}

// ============================================================================
// Trend icon
// ============================================================================

function TrendIcon({ trend }: { trend: DriverPerformance['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-emerald-600" />
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

// ============================================================================
// Summary cards
// ============================================================================

const CARD_ACCENT: Record<string, string> = {
  blue: 'border-blue-200/50 bg-blue-500/5',
  emerald: 'border-emerald-200/50 bg-emerald-500/5',
  amber: 'border-amber-200/50 bg-amber-500/5',
  violet: 'border-violet-200/50 bg-violet-500/5',
}

const ICON_ACCENT: Record<string, string> = {
  blue: 'text-blue-600 bg-blue-100',
  emerald: 'text-emerald-600 bg-emerald-100',
  amber: 'text-amber-600 bg-amber-100',
  violet: 'text-violet-600 bg-violet-100',
}

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'blue' | 'emerald' | 'amber' | 'violet'
}) {
  return (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', CARD_ACCENT[accent])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
          {sub && <p className="mt-0.5 text-[10px] text-muted-foreground/70">{sub}</p>}
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_ACCENT[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Recharts custom tooltip
// ============================================================================

interface ChartTooltipPayload {
  value: number
  name: string
  payload: { name: string; score: number }
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ChartTooltipPayload[]
}) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{entry.payload.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Score: <span className="font-bold tabular-nums text-foreground">{entry.payload.score}</span>
      </p>
    </div>
  )
}

// ============================================================================
// Gradient bar color by score
// ============================================================================

function scoreBarColor(score: number): string {
  if (score >= 75) return '#10b981' // emerald-500
  if (score >= 50) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

// ============================================================================
// Sort helper
// ============================================================================

function sortDrivers(
  drivers: DriverPerformance[],
  sort: SortConfig | undefined
): DriverPerformance[] {
  if (!sort) return drivers
  const { field, direction } = sort
  const mult = direction === 'asc' ? 1 : -1

  return [...drivers].sort((a, b) => {
    const aVal = a[field as keyof DriverPerformance]
    const bVal = b[field as keyof DriverPerformance]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      const av = aVal
      const bv = bVal
      return (av - bv) * mult
    }
    // Handle null rpm/ppm
    const av = aVal === null ? -Infinity : (aVal as number)
    const bv = bVal === null ? -Infinity : (bVal as number)
    return (av - bv) * mult
  })
}

// ============================================================================
// Main dashboard
// ============================================================================

export function DriverPerformanceDashboard({
  initialDrivers,
  initialSummary,
}: DriverPerformanceDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>({
    field: 'performanceScore',
    direction: 'desc',
  })

  const supabase = createClient()

  const { data: drivers } = useQuery({
    queryKey: ['drivers', 'performance', dateRange?.from, dateRange?.to],
    queryFn: () => fetchDriverPerformance(supabase, dateRange),
    initialData: dateRange === undefined ? initialDrivers : undefined,
    staleTime: 60_000,
  })

  const data = drivers ?? initialDrivers

  const summary = useMemo(() => computeDriverSummary(data), [data])
  const displaySummary = dateRange === undefined ? initialSummary : summary

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((d) => d.driverName.toLowerCase().includes(q))
  }, [data, search])

  // Sort
  const sorted = useMemo(() => sortDrivers(filtered, sort), [filtered, sort])

  // Top 10 for chart (sorted by score desc)
  const chartData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10)
      .map((d) => ({
        name: d.driverName,
        score: d.performanceScore,
      }))
  }, [data])

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return sorted.map((d, i) => ({
      rank: String(i + 1),
      driverName: d.driverName,
      driverType: DRIVER_TYPE_LABEL[d.driverType] ?? d.driverType,
      score: String(d.performanceScore),
      trips: String(d.tripCount),
      revenue: d.revenue.toFixed(2),
      profitContribution: d.profitContribution.toFixed(2),
      rpm: d.rpm !== null ? d.rpm.toFixed(2) : '',
      onTimeRate: fmtPct(d.onTimeRate),
      utilization: fmtPct(d.utilizationPct),
      trend: d.trend,
    }))
  }, [sorted])

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-end">
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Total Drivers"
          value={String(displaySummary.totalDrivers)}
          sub="with trip data this period"
          icon={Users}
          accent="blue"
        />
        <SummaryCard
          label="Avg Performance Score"
          value={`${displaySummary.avgPerformanceScore}`}
          sub="out of 100"
          icon={Activity}
          accent="emerald"
        />
        <SummaryCard
          label="Top Driver"
          value={displaySummary.topDriverName}
          sub={`score ${data.find((d) => d.driverName === displaySummary.topDriverName)?.performanceScore ?? '—'}`}
          icon={Star}
          accent="amber"
        />
        <SummaryCard
          label="Avg Utilization"
          value={`${displaySummary.avgUtilization}%`}
          sub={`total revenue ${fmt$(displaySummary.totalRevenue)}`}
          icon={DollarSign}
          accent="violet"
        />
      </div>

      {/* Ranking table + chart — two-column on wide screens */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Performance Ranking Table */}
        <div className="widget-card">
          <div className="widget-header">
            <h3 className="widget-title">
              <span className="widget-accent-dot bg-brand" />
              Performance Rankings
            </h3>
            <div className="flex items-center gap-2">
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
                filename="driver-performance"
                headers={[
                  'rank',
                  'driverName',
                  'driverType',
                  'score',
                  'trips',
                  'revenue',
                  'profitContribution',
                  'rpm',
                  'onTimeRate',
                  'utilization',
                  'trend',
                ]}
                fetchData={handleCsvExport}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Driver</th>
                  <th className="py-2 px-3 text-right">
                    <SortHeader
                      label="Score"
                      field="performanceScore"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
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
                      label="Profit"
                      field="profitContribution"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2 px-3 text-right">
                    <SortHeader
                      label="RPM"
                      field="rpm"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2 px-3 text-right">
                    <SortHeader
                      label="On-Time"
                      field="onTimeRate"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2 px-3 text-right">
                    <SortHeader
                      label="Utilization"
                      field="utilizationPct"
                      currentSort={sort}
                      onSort={setSort}
                      className="justify-end"
                    />
                  </th>
                  <th className="py-2 pl-3 text-center text-xs font-medium text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {search
                        ? `No drivers match "${search}"`
                        : 'No driver trip data for this period.'}
                    </td>
                  </tr>
                ) : (
                  sorted.map((driver, idx) => (
                    <tr
                      key={driver.driverId}
                      className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2.5 pr-3 text-xs font-medium text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{driver.driverName}</span>
                          <DriverTypeBadge type={driver.driverType} />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <ScoreBadge score={driver.performanceScore} />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {driver.tripCount}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-foreground">
                        {fmt$(driver.revenue)}
                      </td>
                      <td
                        className={cn(
                          'py-2.5 px-3 text-right tabular-nums font-medium',
                          driver.profitContribution >= 0 ? 'text-emerald-700' : 'text-red-600'
                        )}
                      >
                        {fmt$(driver.profitContribution)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                        {fmtPerMile(driver.rpm)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={cn(
                            'tabular-nums font-medium',
                            driver.onTimeRate >= 90
                              ? 'text-emerald-700'
                              : driver.onTimeRate >= 70
                                ? 'text-amber-700'
                                : 'text-red-600'
                          )}
                        >
                          {fmtPct(driver.onTimeRate)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={cn(
                            'tabular-nums',
                            driver.utilizationPct >= 60
                              ? 'text-emerald-700'
                              : driver.utilizationPct >= 30
                                ? 'text-amber-700'
                                : 'text-muted-foreground'
                          )}
                        >
                          {fmtPct(driver.utilizationPct)}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-center">
                        <TrendIcon trend={driver.trend} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {sorted.length > 0 && (
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Showing {sorted.length} driver{sorted.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Driver Comparison Chart */}
        <div className="widget-card">
          <div className="widget-header">
            <h3 className="widget-title">
              <span className="widget-accent-dot bg-brand" />
              Top 10 by Score
            </h3>
          </div>

          {chartData.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              No data for this period
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="bar-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    horizontal={false}
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={96}
                    tick={{ fontSize: 11, fill: 'var(--foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) =>
                      v.length > 12 ? `${v.slice(0, 12)}…` : v
                    }
                  />
                  <Tooltip
                    content={<BarTooltip />}
                    cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={scoreBarColor(entry.score)}
                        opacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
