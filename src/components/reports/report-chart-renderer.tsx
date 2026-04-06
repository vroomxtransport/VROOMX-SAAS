'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import type { SortConfig } from '@/types/filters'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { BarChart3 } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface ColumnDef {
  key: string
  label: string
  format: 'currency' | 'number' | 'percent' | 'miles' | 'text'
}

interface ReportChartRendererProps {
  chartType: 'table' | 'bar' | 'line' | 'pie' | 'area'
  columns: ColumnDef[]
  rows: Record<string, string | number | null>[]
  title?: string
  className?: string
}

// ============================================================================
// Formatting
// ============================================================================

const CHART_COLORS = ['#059669', '#2563eb', '#d97706', '#dc2626', '#7c3aed']

function formatValue(value: string | number | null, fmt: string): string {
  if (value === null || value === undefined) return '\u2014'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) && fmt !== 'text') return String(value)

  switch (fmt) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
    case 'percent':
      return `${num.toFixed(1)}%`
    case 'miles':
      return `${num.toLocaleString()} mi`
    case 'number':
      return num.toLocaleString()
    default:
      return String(value)
  }
}

function compactFormat(value: number, fmt: string): string {
  if (fmt === 'currency') {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`
    return `$${value.toFixed(0)}`
  }
  if (fmt === 'percent') return `${value.toFixed(0)}%`
  if (fmt === 'miles') return `${(value / 1_000).toFixed(0)}k mi`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(0)
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="widget-card flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">No data available</p>
      <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your filters or date range</p>
    </div>
  )
}

// ============================================================================
// Custom Tooltip
// ============================================================================

function ChartTooltip({ active, payload, label, columns }: {
  active?: boolean
  payload?: ReadonlyArray<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
  columns: ColumnDef[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((p) => {
        const col = columns.find((c) => c.key === p.dataKey)
        return (
          <div key={p.dataKey} className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}:</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatValue(p.value, col?.format ?? 'number')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Table Chart
// ============================================================================

function TableChart({ columns, rows }: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] }) {
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)
  const MAX_ROWS = 100

  const sorted = useMemo(() => {
    if (!sort) return rows
    const { field, direction } = sort
    const mult = direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const aVal = a[field]
      const bVal = b[field]
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * mult
      return String(aVal).localeCompare(String(bVal)) * mult
    })
  }, [rows, sort])

  const displayed = sorted.slice(0, MAX_ROWS)

  const handleCsvExport = useCallback(async () => {
    return sorted.map((row) => {
      const obj: Record<string, string> = {}
      for (const col of columns) {
        obj[col.label] = formatValue(row[col.key], col.format)
      }
      return obj
    })
  }, [sorted, columns])

  return (
    <>
      <div className="flex items-center justify-end mb-2">
        <CsvExportButton
          filename="custom-report"
          headers={columns.map((c) => c.label)}
          fetchData={handleCsvExport}
          className="h-8 text-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              {columns.map((col) => (
                <th key={col.key} className={cn('py-2 px-3', col.format === 'text' ? 'text-left' : 'text-right')}>
                  <SortHeader
                    label={col.label}
                    field={col.key}
                    currentSort={sort}
                    onSort={setSort}
                    className={col.format === 'text' ? 'justify-start' : 'justify-end'}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => (
              <tr key={i} className="border-b border-border-subtle/50 last:border-0 hover:bg-muted/30 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'py-2 px-3',
                      col.format === 'text' ? 'text-left text-foreground' : 'text-right tabular-nums text-foreground'
                    )}
                  >
                    {formatValue(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground text-right">
          {rows.length > MAX_ROWS
            ? `Showing ${MAX_ROWS} of ${rows.length} rows`
            : `${rows.length} row${rows.length !== 1 ? 's' : ''}`}
        </p>
      </div>
    </>
  )
}

// ============================================================================
// Bar Chart
// ============================================================================

function BarChartView({ columns, rows }: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] }) {
  const dimCol = columns[0]
  const metricCols = columns.slice(1)

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            {metricCols.map((_, i) => (
              <linearGradient key={`barGrad-${i}`} id={`barGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.9} />
                <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false} />
          <XAxis
            dataKey={dimCol.key}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => compactFormat(v, metricCols[0]?.format ?? 'number')}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={({ active, payload, label: tl }) => (
            <ChartTooltip active={active} payload={payload as ReadonlyArray<{ name: string; value: number; color: string; dataKey: string }>} label={String(tl ?? '')} columns={columns} />
          )} />
          {metricCols.length > 1 && <Legend />}
          {metricCols.map((col, i) => (
            <Bar
              key={col.key}
              dataKey={col.key}
              name={col.label}
              fill={`url(#barGrad-${i})`}
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Line Chart
// ============================================================================

function LineChartView({ columns, rows }: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] }) {
  const dimCol = columns[0]
  const metricCols = columns.slice(1)

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false} />
          <XAxis
            dataKey={dimCol.key}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => compactFormat(v, metricCols[0]?.format ?? 'number')}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={({ active, payload, label: tl }) => (
            <ChartTooltip active={active} payload={payload as ReadonlyArray<{ name: string; value: number; color: string; dataKey: string }>} label={String(tl ?? '')} columns={columns} />
          )} />
          {metricCols.length > 1 && <Legend />}
          {metricCols.map((col, i) => (
            <Line
              key={col.key}
              type="monotone"
              dataKey={col.key}
              name={col.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: CHART_COLORS[i % CHART_COLORS.length] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Area Chart
// ============================================================================

function AreaChartView({ columns, rows }: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] }) {
  const dimCol = columns[0]
  const metricCols = columns.slice(1)

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <defs>
            {metricCols.map((_, i) => (
              <linearGradient key={`areaGrad-${i}`} id={`areaGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false} />
          <XAxis
            dataKey={dimCol.key}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => compactFormat(v, metricCols[0]?.format ?? 'number')}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={({ active, payload, label: tl }) => (
            <ChartTooltip active={active} payload={payload as ReadonlyArray<{ name: string; value: number; color: string; dataKey: string }>} label={String(tl ?? '')} columns={columns} />
          )} />
          {metricCols.length > 1 && <Legend />}
          {metricCols.map((col, i) => (
            <Area
              key={col.key}
              type="monotone"
              dataKey={col.key}
              name={col.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={`url(#areaGrad-${i})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Pie Chart
// ============================================================================

function PieChartView({ columns, rows }: { columns: ColumnDef[]; rows: Record<string, string | number | null>[] }) {
  const dimCol = columns[0]
  const metricCol = columns.find((c) => c.format !== 'text') ?? columns[1]
  if (!metricCol) return <EmptyState />

  const data = rows.map((row) => ({
    name: String(row[dimCol.key] ?? 'Unknown'),
    value: typeof row[metricCol.key] === 'number' ? row[metricCol.key] : parseFloat(String(row[metricCol.key] ?? '0')),
  }))

  const total = data.reduce((s, d) => s + (typeof d.value === 'number' ? d.value : 0), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (props: any) => {
    const cx = Number(props.cx ?? 0)
    const cy = Number(props.cy ?? 0)
    const midAngle = Number(props.midAngle ?? 0)
    const innerRadius = Number(props.innerRadius ?? 0)
    const outerRadius = Number(props.outerRadius ?? 0)
    const percent = Number(props.percent ?? 0)
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
    )
  }

  return (
    <div className="h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            label={renderLabel}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]
              const pct = total > 0 ? (((d.value as number) / total) * 100).toFixed(1) : '0'
              return (
                <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
                  <p className="text-xs font-medium text-foreground mb-1">{d.name}</p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatValue(d.value as number, metricCol.format)}
                  </p>
                  <p className="text-xs text-muted-foreground">{pct}% of total</p>
                </div>
              )
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Main Renderer
// ============================================================================

export function ReportChartRenderer({ chartType, columns, rows, title, className }: ReportChartRendererProps) {
  if (rows.length === 0) return <EmptyState />

  return (
    <div className={cn('widget-card', className)}>
      {title && (
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            {title}
          </h3>
        </div>
      )}

      {chartType === 'table' && <TableChart columns={columns} rows={rows} />}
      {chartType === 'bar' && <BarChartView columns={columns} rows={rows} />}
      {chartType === 'line' && <LineChartView columns={columns} rows={rows} />}
      {chartType === 'pie' && <PieChartView columns={columns} rows={rows} />}
      {chartType === 'area' && <AreaChartView columns={columns} rows={rows} />}
    </div>
  )
}
