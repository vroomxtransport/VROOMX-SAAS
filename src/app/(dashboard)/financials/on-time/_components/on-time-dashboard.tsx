'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  fetchOTDMetrics,
  fetchOTDByDriver,
  fetchOTDByBroker,
} from '@/lib/queries/on-time-analytics'
import type { OTDMetrics, OTDByDriver, OTDByBroker, OTDTrend } from '@/lib/queries/on-time-analytics'
import { PeriodSelector } from '../../_components/period-selector'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'
import type { DateRange, SortConfig } from '@/types/filters'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

// ============================================================================
// Helpers
// ============================================================================

function otdRateBadgeClass(rate: number): string {
  if (rate >= 95) return 'bg-emerald-100 text-emerald-700'
  if (rate >= 85) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function varianceLabel(days: number): string {
  if (days === 0) return '0.0 days'
  const sign = days > 0 ? '+' : ''
  return `${sign}${days.toFixed(1)} days`
}

function varianceClass(days: number): string {
  if (days <= 0) return 'text-emerald-600'
  if (days <= 1) return 'text-amber-600'
  return 'text-red-600'
}

// ============================================================================
// KPI Cards
// ============================================================================

interface KPICardsProps {
  metrics: OTDMetrics
}

function KPICards({ metrics }: KPICardsProps) {
  const rateAccent = metrics.onTimeRate >= 95
    ? 'bg-emerald-500'
    : metrics.onTimeRate >= 85
      ? 'bg-amber-500'
      : 'bg-red-500'

  const cards = [
    {
      label: 'On-Time Rate',
      value: `${metrics.onTimeRate.toFixed(1)}%`,
      sub: `${metrics.onTimeCount} on-time of ${metrics.totalDelivered}`,
      accent: rateAccent,
    },
    {
      label: 'Total Delivered',
      value: String(metrics.totalDelivered),
      sub: `${metrics.earlyCount} early, ${metrics.onTimeCount - metrics.earlyCount} on-time`,
      accent: 'bg-brand',
    },
    {
      label: 'Late Deliveries',
      value: String(metrics.lateCount),
      sub: metrics.totalDelivered > 0
        ? `${(100 - metrics.onTimeRate).toFixed(1)}% of deliveries`
        : 'No data this period',
      accent: metrics.lateCount > 0 ? 'bg-red-500' : 'bg-emerald-500',
    },
    {
      label: 'Avg Days Variance',
      value: varianceLabel(metrics.avgDaysVariance),
      sub: metrics.avgDaysVariance <= 0 ? 'Trending early' : 'Trending late',
      accent: metrics.avgDaysVariance <= 0 ? 'bg-emerald-500' : 'bg-red-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="widget-card">
          <div className="flex items-start gap-3">
            <div className={cn('w-1 h-10 rounded-full shrink-0', card.accent)} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="text-xl font-semibold tabular-nums text-foreground mt-0.5 truncate">
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.sub}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// OTD Trend Chart
// ============================================================================

interface TrendChartProps {
  data: OTDTrend[]
}

interface TrendTooltipPayload {
  name: string
  value: number
  color: string
}

interface TrendTooltipProps {
  active?: boolean
  payload?: TrendTooltipPayload[]
  label?: string
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) return null

  const rate = payload.find((p) => p.name === 'On-Time %')?.value
  const delivered = payload.find((p) => p.name === 'Delivered')?.value
  const late = payload.find((p) => p.name === 'Late')?.value

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {rate !== undefined && (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs text-muted-foreground">On-Time Rate</span>
          <span className="text-xs font-semibold tabular-nums text-foreground ml-auto pl-3">
            {rate.toFixed(1)}%
          </span>
        </div>
      )}
      {delivered !== undefined && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
          <span className="text-xs text-muted-foreground">Delivered</span>
          <span className="text-xs font-semibold tabular-nums text-foreground ml-auto pl-3">
            {delivered}
          </span>
        </div>
      )}
      {late !== undefined && late > 0 && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-xs text-muted-foreground">Late</span>
          <span className="text-xs font-semibold tabular-nums text-red-600 ml-auto pl-3">
            {late}
          </span>
        </div>
      )}
    </div>
  )
}

function OTDTrendChart({ data }: TrendChartProps) {
  const hasData = data.some((d) => d.totalDelivered > 0)

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-emerald-500" />
          On-Time Rate Trend
        </h3>
        <p className="text-xs text-muted-foreground">Last 6 months</p>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No delivered orders in the last 6 months
        </p>
      ) : (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="otdLineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border-subtle))"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip content={<TrendTooltip />} />
              {/* Industry target reference line at 95% */}
              <ReferenceLine
                y={95}
                stroke="#10b981"
                strokeDasharray="6 3"
                strokeOpacity={0.5}
                label={{
                  value: '95% target',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
              <Line
                type="monotone"
                dataKey="onTimeRate"
                name="On-Time %"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3.5, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="totalDelivered"
                name="Delivered"
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                connectNulls
                yAxisId={0}
              />
              <Line
                type="monotone"
                dataKey="lateCount"
                name="Late"
                stroke="#f87171"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                connectNulls
                yAxisId={0}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// OTD by Driver Table
// ============================================================================

interface OTDByDriverTableProps {
  data: OTDByDriver[]
}

function OTDByDriverTable({ data }: OTDByDriverTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((d) => d.driverName.toLowerCase().includes(q))
  }, [data, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof OTDByDriver]
      const bVal = b[field as keyof OTDByDriver]
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mult
      return String(aVal ?? '').localeCompare(String(bVal ?? '')) * mult
    })
  }, [filtered, sort])

  const handleCsvExport = useCallback(async () => {
    return sorted.map((d) => ({
      driverName: d.driverName,
      totalDelivered: String(d.totalDelivered),
      onTimeCount: String(d.onTimeCount),
      onTimeRate: `${d.onTimeRate.toFixed(1)}%`,
      avgDaysVariance: varianceLabel(d.avgDaysVariance),
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            OTD by Driver
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No delivered orders with assigned drivers this period
        </p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          OTD by Driver
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
            filename="otd-by-driver"
            headers={['driverName', 'totalDelivered', 'onTimeCount', 'onTimeRate', 'avgDaysVariance']}
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
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                  Driver
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Delivered"
                    field="totalDelivered"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="On-Time"
                    field="onTimeCount"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="OTD Rate"
                    field="onTimeRate"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortHeader
                    label="Avg Variance"
                    field="avgDaysVariance"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((driver) => (
                <tr
                  key={driver.driverId}
                  className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 pr-3 font-medium text-foreground">{driver.driverName}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {driver.totalDelivered}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {driver.onTimeCount}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        otdRateBadgeClass(driver.onTimeRate)
                      )}
                    >
                      {driver.onTimeRate.toFixed(1)}%
                    </span>
                  </td>
                  <td
                    className={cn(
                      'py-2.5 pl-3 text-right tabular-nums text-sm font-medium',
                      varianceClass(driver.avgDaysVariance)
                    )}
                  >
                    {varianceLabel(driver.avgDaysVariance)}
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

// ============================================================================
// OTD by Broker Table
// ============================================================================

interface OTDByBrokerTableProps {
  data: OTDByBroker[]
}

function OTDByBrokerTable({ data }: OTDByBrokerTableProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase().trim()
    return data.filter((b) => b.brokerName.toLowerCase().includes(q))
  }, [data, search])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const aVal = a[field as keyof OTDByBroker]
      const bVal = b[field as keyof OTDByBroker]
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mult
      return String(aVal ?? '').localeCompare(String(bVal ?? '')) * mult
    })
  }, [filtered, sort])

  const handleCsvExport = useCallback(async () => {
    return sorted.map((b) => ({
      brokerName: b.brokerName,
      totalDelivered: String(b.totalDelivered),
      onTimeCount: String(b.onTimeCount),
      onTimeRate: `${b.onTimeRate.toFixed(1)}%`,
      avgDaysVariance: varianceLabel(b.avgDaysVariance),
    }))
  }, [sorted])

  if (data.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-blue-500" />
            OTD by Broker
          </h3>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No delivered orders with assigned brokers this period
        </p>
      </div>
    )
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-blue-500" />
          OTD by Broker
        </h3>
        <div className="flex items-center gap-2">
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
            filename="otd-by-broker"
            headers={['brokerName', 'totalDelivered', 'onTimeCount', 'onTimeRate', 'avgDaysVariance']}
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
                <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                  Broker
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="Delivered"
                    field="totalDelivered"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="On-Time"
                    field="onTimeCount"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 px-3 text-right">
                  <SortHeader
                    label="OTD Rate"
                    field="onTimeRate"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
                <th className="py-2 pl-3 text-right">
                  <SortHeader
                    label="Avg Variance"
                    field="avgDaysVariance"
                    currentSort={sort}
                    onSort={setSort}
                    className="justify-end"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((broker) => (
                <tr
                  key={broker.brokerId}
                  className="border-b border-border-subtle/50 last:border-0 bg-card hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2.5 pr-3 font-medium text-foreground">{broker.brokerName}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {broker.totalDelivered}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">
                    {broker.onTimeCount}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                        otdRateBadgeClass(broker.onTimeRate)
                      )}
                    >
                      {broker.onTimeRate.toFixed(1)}%
                    </span>
                  </td>
                  <td
                    className={cn(
                      'py-2.5 pl-3 text-right tabular-nums text-sm font-medium',
                      varianceClass(broker.avgDaysVariance)
                    )}
                  >
                    {varianceLabel(broker.avgDaysVariance)}
                  </td>
                </tr>
              ))}
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

// ============================================================================
// Main Dashboard
// ============================================================================

interface OnTimeDashboardProps {
  initialMetrics: OTDMetrics
  initialByDriver: OTDByDriver[]
  initialByBroker: OTDByBroker[]
  initialTrend: OTDTrend[]
}

export function OnTimeDashboard({
  initialMetrics,
  initialByDriver,
  initialByBroker,
  initialTrend,
}: OnTimeDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const supabase = createClient()

  const { data: metrics } = useQuery({
    queryKey: ['financials', 'otd', 'metrics', dateRange?.from, dateRange?.to],
    queryFn: () => fetchOTDMetrics(supabase, dateRange),
    initialData: dateRange === undefined ? initialMetrics : undefined,
    staleTime: 60_000,
  })

  const { data: byDriver } = useQuery({
    queryKey: ['financials', 'otd', 'byDriver', dateRange?.from, dateRange?.to],
    queryFn: () => fetchOTDByDriver(supabase, dateRange),
    initialData: dateRange === undefined ? initialByDriver : undefined,
    staleTime: 60_000,
  })

  const { data: byBroker } = useQuery({
    queryKey: ['financials', 'otd', 'byBroker', dateRange?.from, dateRange?.to],
    queryFn: () => fetchOTDByBroker(supabase, dateRange),
    initialData: dateRange === undefined ? initialByBroker : undefined,
    staleTime: 60_000,
  })

  const currentMetrics = metrics ?? initialMetrics
  const currentByDriver = byDriver ?? initialByDriver
  const currentByBroker = byBroker ?? initialByBroker

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">On-Time Delivery</h2>
          <p className="text-sm text-muted-foreground">
            Scheduled vs. actual delivery performance across your fleet
          </p>
        </div>
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Summary Cards */}
      <KPICards metrics={currentMetrics} />

      {/* Trend Chart */}
      <OTDTrendChart data={initialTrend} />

      {/* Driver + Broker Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <OTDByDriverTable data={currentByDriver} />
        <OTDByBrokerTable data={currentByBroker} />
      </div>
    </div>
  )
}
