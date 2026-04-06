'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFleetUtilization,
  computeFleetSummary,
} from '@/lib/queries/fleet-utilization'
import type { TruckUtilization, FleetSummary } from '@/lib/queries/fleet-utilization'
import { PeriodSelector } from '../../_components/period-selector'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import type { DateRange, SortConfig } from '@/types/filters'
import { cn } from '@/lib/utils'
import {
  Truck,
  Activity,
  DollarSign,
  TrendingUp,
  Search,
  X,
} from 'lucide-react'
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

// ============================================================================
// Helpers
// ============================================================================

function fmt$(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(val) >= 1_000) {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtMoney(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPerMile(val: number | null): string {
  if (val === null) return 'N/A'
  return `$${val.toFixed(2)}`
}

function utilizationColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function utilizationBarFill(pct: number): string {
  if (pct >= 70) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function utilizationTextClass(pct: number): string {
  if (pct >= 70) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

// ============================================================================
// Custom Recharts Tooltip
// ============================================================================

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { unitNumber: string } }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const pct = entry?.value ?? 0

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: utilizationBarFill(pct) }}
        />
        <span className="text-xs text-muted-foreground">Utilization</span>
        <span className={cn('ml-auto text-xs font-semibold tabular-nums', utilizationTextClass(pct))}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Summary Cards
// ============================================================================

interface SummaryCardProps {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  valueClass?: string
}

function SummaryCard({ label, value, sub, icon: Icon, valueClass }: SummaryCardProps) {
  return (
    <div className="widget-card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </div>
      <div>
        <p className={cn('text-2xl font-semibold tracking-tight tabular-nums', valueClass)}>
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

// ============================================================================
// Utilization Bar Chart
// ============================================================================

interface UtilizationChartProps {
  trucks: TruckUtilization[]
}

function UtilizationChart({ trucks }: UtilizationChartProps) {
  const chartData = useMemo(
    () =>
      trucks
        .slice(0, 15)
        .map((t) => ({
          unitNumber: t.unitNumber,
          utilizationPct: t.utilizationPct,
        })),
    [trucks]
  )

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const renderTooltip = useCallback((props: any) => <ChartTooltip {...(props as ChartTooltipProps)} />, [])

  if (chartData.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Utilization by Truck
          </h3>
        </div>
        <p className="py-12 text-center text-sm text-muted-foreground">
          No data for this period.
        </p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Utilization by Truck
        </h3>
        <p className="text-xs text-muted-foreground">Top 15 trucks</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="unitNumber"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
            <Bar dataKey="utilizationPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.unitNumber}
                  fill={utilizationBarFill(entry.utilizationPct)}
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
// Main Utilization Table
// ============================================================================

interface UtilizationTableProps {
  trucks: TruckUtilization[]
}

function UtilizationTable({ trucks }: UtilizationTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  const filtered = useMemo(() => {
    if (!search.trim()) return trucks
    const q = search.toLowerCase().trim()
    return trucks.filter(
      (t) =>
        t.unitNumber.toLowerCase().includes(q) ||
        t.make.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q)
    )
  }, [trucks, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof TruckUtilization]
      const bVal = b[field as keyof TruckUtilization]
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1 * mult
      if (bVal === null) return -1 * mult
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * mult
      }
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [filtered, sort])

  const maxAbsProfit = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((t) => Math.abs(t.profit)), 1)
  }, [sorted])

  const handleCsvExport = useCallback(async () => {
    return sorted.map((t) => ({
      unitNumber: t.unitNumber,
      make: t.make,
      model: t.model,
      year: t.year !== null ? String(t.year) : '',
      tripCount: String(t.tripCount),
      orderCount: String(t.orderCount),
      totalMiles: String(t.totalMiles),
      activeDays: String(t.activeDays),
      idleDays: String(t.idleDays),
      utilizationPct: `${t.utilizationPct.toFixed(1)}%`,
      revenue: t.revenue.toFixed(2),
      expenses: t.expenses.toFixed(2),
      profit: t.profit.toFixed(2),
      revenuePerMile: t.revenuePerMile !== null ? t.revenuePerMile.toFixed(2) : '',
      profitPerMile: t.profitPerMile !== null ? t.profitPerMile.toFixed(2) : '',
    }))
  }, [sorted])

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Fleet Utilization
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
            filename="fleet-utilization"
            headers={[
              'unitNumber',
              'make',
              'model',
              'year',
              'tripCount',
              'orderCount',
              'totalMiles',
              'activeDays',
              'idleDays',
              'utilizationPct',
              'revenue',
              'expenses',
              'profit',
              'revenuePerMile',
              'profitPerMile',
            ]}
            fetchData={handleCsvExport}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {search ? `No trucks match "${search}"` : 'No truck data for this period.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                  Unit
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                  Make / Model
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
                    label="Orders"
                    field="orderCount"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Miles"
                    field="totalMiles"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-left">
                  <SortHeader
                    label="Utilization"
                    field="utilizationPct"
                    currentSort={sort}
                    onSort={setSort}
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
                    field="profit"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">
                  Rev/Mile
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((truck) => {
                const profitBarWidth = Math.min(
                  (Math.abs(truck.profit) / maxAbsProfit) * 100,
                  100
                )
                const utilizBgClass = utilizationColor(truck.utilizationPct)
                const utilizTextClass = utilizationTextClass(truck.utilizationPct)

                return (
                  <tr
                    key={truck.truckId}
                    className="border-b border-border-subtle/50 bg-card transition-colors last:border-0 hover:bg-muted/30"
                  >
                    {/* Unit # */}
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-brand">{truck.unitNumber}</span>
                    </td>

                    {/* Make / Model */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {truck.make && truck.model
                        ? `${truck.make} ${truck.model}`
                        : truck.make || truck.model || '—'}
                      {truck.year && (
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          {truck.year}
                        </span>
                      )}
                    </td>

                    {/* Trips */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {truck.tripCount}
                    </td>

                    {/* Orders */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {truck.orderCount}
                    </td>

                    {/* Miles */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {truck.totalMiles > 0 ? truck.totalMiles.toLocaleString() : '—'}
                    </td>

                    {/* Utilization bar + % */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', utilizBgClass, 'opacity-60')}
                            style={{ width: `${truck.utilizationPct}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            'min-w-[3rem] text-xs font-semibold tabular-nums',
                            utilizTextClass
                          )}
                        >
                          {truck.utilizationPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Revenue */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                      {fmtMoney(truck.revenue)}
                    </td>

                    {/* Profit with inline bar */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="relative flex items-center justify-end">
                        <div
                          className={cn(
                            'absolute inset-y-0 right-0 rounded-sm',
                            truck.profit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          )}
                          style={{ width: `${profitBarWidth}%` }}
                        />
                        <span
                          className={cn(
                            'relative tabular-nums font-medium',
                            truck.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                          )}
                        >
                          {fmtMoney(truck.profit)}
                        </span>
                      </div>
                    </td>

                    {/* Rev/Mile */}
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">
                      {fmtPerMile(truck.revenuePerMile)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="mt-2 text-right text-xs text-muted-foreground">
              {sorted.length} truck{sorted.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Dashboard Root
// ============================================================================

interface FleetUtilizationDashboardProps {
  initialTrucks: TruckUtilization[]
  initialSummary: FleetSummary
}

export function FleetUtilizationDashboard({
  initialTrucks,
  initialSummary,
}: FleetUtilizationDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const supabase = createClient()

  const { data: trucks } = useQuery({
    queryKey: ['financials', 'fleet', dateRange?.from, dateRange?.to],
    queryFn: () => fetchFleetUtilization(supabase, dateRange),
    initialData: dateRange === undefined ? initialTrucks : undefined,
    staleTime: 60_000,
  })

  const data = trucks ?? initialTrucks

  const summary = useMemo(
    () => (data.length > 0 ? computeFleetSummary(data) : initialSummary),
    [data, initialSummary]
  )

  const avgUtilClass = utilizationTextClass(summary.avgUtilization)

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end">
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Active Trucks"
          value={`${summary.activeTrucks}`}
          sub={`of ${summary.totalTrucks} total`}
          icon={Truck}
        />
        <SummaryCard
          label="Avg Utilization"
          value={`${summary.avgUtilization.toFixed(1)}%`}
          sub={
            summary.avgUtilization >= 70
              ? 'On target'
              : summary.avgUtilization >= 50
                ? 'Needs attention'
                : 'Below threshold'
          }
          icon={Activity}
          valueClass={avgUtilClass}
        />
        <SummaryCard
          label="Revenue / Truck"
          value={fmt$(summary.revenuePerTruck)}
          sub={`${fmt$(summary.totalRevenue)} total`}
          icon={DollarSign}
        />
        <SummaryCard
          label="Profit / Truck"
          value={fmt$(summary.profitPerTruck)}
          sub={`${fmt$(summary.totalProfit)} total`}
          icon={TrendingUp}
          valueClass={summary.profitPerTruck >= 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* Chart */}
      <UtilizationChart trucks={data} />

      {/* Table */}
      <UtilizationTable trucks={data} />
    </div>
  )
}
