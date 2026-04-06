'use client'

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

interface ChartDataPoint {
  period: string
  value: number
}

interface ConfidenceBand {
  upper: ChartDataPoint[]
  lower: ChartDataPoint[]
}

export interface ForecastChartProps {
  historical: ChartDataPoint[]
  projected: ChartDataPoint[]
  confidence?: ConfidenceBand
  title: string
  format: 'currency' | 'percent' | 'number'
  className?: string
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatValue(value: number, fmt: ForecastChartProps['format']): string {
  switch (fmt) {
    case 'currency':
      if (Math.abs(value) >= 1_000_000)
        return `$${(value / 1_000_000).toFixed(1)}M`
      if (Math.abs(value) >= 1_000)
        return `$${(value / 1_000).toFixed(0)}K`
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'number':
      return value.toLocaleString()
  }
}

// ============================================================================
// Merged data shape for Recharts
// ============================================================================

interface MergedPoint {
  period: string
  historical?: number
  projected?: number
  confidenceUpper?: number
  confidenceLower?: number
  isProjected: boolean
}

function buildChartData(
  historical: ChartDataPoint[],
  projected: ChartDataPoint[],
  confidence?: ConfidenceBand
): MergedPoint[] {
  const map = new Map<string, MergedPoint>()

  for (const h of historical) {
    map.set(h.period, {
      period: h.period,
      historical: h.value,
      isProjected: false,
    })
  }

  const upperMap = new Map(confidence?.upper.map((p) => [p.period, p.value]) ?? [])
  const lowerMap = new Map(confidence?.lower.map((p) => [p.period, p.value]) ?? [])

  // Connect the last historical point into projected series so the line is continuous
  const lastHistorical = historical[historical.length - 1]

  if (lastHistorical && projected.length > 0) {
    const existing = map.get(lastHistorical.period)
    if (existing) {
      existing.projected = lastHistorical.value
      existing.confidenceUpper = upperMap.get(lastHistorical.period) ?? lastHistorical.value
      existing.confidenceLower = lowerMap.get(lastHistorical.period) ?? lastHistorical.value
    }
  }

  for (const p of projected) {
    map.set(p.period, {
      period: p.period,
      projected: p.value,
      confidenceUpper: upperMap.get(p.period),
      confidenceLower: lowerMap.get(p.period),
      isProjected: true,
    })
  }

  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period))
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface TooltipPayloadEntry {
  name: string
  value: number
  dataKey: string
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
  format: ForecastChartProps['format']
  todayPeriod: string
}

function ForecastTooltip({ active, payload, label, format, todayPeriod }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null

  const isProjected = label > todayPeriod
  const relevantEntries = payload.filter(
    (e) => e.dataKey === 'historical' || e.dataKey === 'projected'
  )

  if (relevantEntries.length === 0) return null

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg min-w-[140px]">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {isProjected && (
        <p className="text-[10px] uppercase tracking-wide text-brand-muted font-semibold mb-1.5">
          Projected
        </p>
      )}
      {relevantEntries.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-semibold tabular-nums text-foreground ml-auto">
            {formatValue(entry.value, format)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Chart Component
// ============================================================================

const HISTORICAL_COLOR = '#059669' // emerald-600
const PROJECTED_COLOR = '#34d399' // emerald-400 — lighter for projection

export function ForecastChart({
  historical,
  projected,
  confidence,
  title,
  format,
  className,
}: ForecastChartProps) {
  const todayPeriod = new Date().toISOString().slice(0, 7) // 'yyyy-MM'
  const chartData = buildChartData(historical, projected, confidence)
  const hasConfidence = Boolean(
    confidence && confidence.upper.length > 0 && confidence.lower.length > 0
  )
  const hasProjected = projected.length > 0

  // YAxis formatter
  const yFormatter = (v: number) => formatValue(v, format)

  return (
    <div className={cn('w-full', className)}>
      {title && (
        <p className="text-sm font-semibold text-foreground mb-3">{title}</p>
      )}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              {/* Confidence band gradient */}
              <linearGradient id="fcConfidenceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HISTORICAL_COLOR} stopOpacity={0.12} />
                <stop offset="100%" stopColor={HISTORICAL_COLOR} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e5e7eb)" vertical={false} />

            <XAxis
              dataKey="period"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={yFormatter}
              width={60}
            />

            <Tooltip
              content={(props) => (
                <ForecastTooltip
                  {...(props as unknown as CustomTooltipProps)}
                  format={format}
                  todayPeriod={todayPeriod}
                />
              )}
            />

            {/* "Today" reference line */}
            <ReferenceLine
              x={todayPeriod}
              stroke="var(--border-subtle, #d1d5db)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{
                value: 'Today',
                position: 'top',
                fontSize: 10,
                fill: 'var(--muted-foreground, #6b7280)',
                dy: -4,
              }}
            />

            {/* Confidence band — rendered as area between upper and lower */}
            {hasConfidence && hasProjected && (
              <Area
                type="monotone"
                dataKey="confidenceUpper"
                stroke="none"
                fill="url(#fcConfidenceGrad)"
                fillOpacity={0.6}
                connectNulls
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {hasConfidence && hasProjected && (
              <Area
                type="monotone"
                dataKey="confidenceLower"
                stroke="none"
                fill="var(--surface, #ffffff)"
                fillOpacity={1}
                connectNulls
                legendType="none"
                isAnimationActive={false}
              />
            )}

            {/* Historical line — solid, strong color */}
            <Line
              type="monotone"
              dataKey="historical"
              name="Historical"
              stroke={HISTORICAL_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: HISTORICAL_COLOR, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: HISTORICAL_COLOR }}
              connectNulls
              legendType="none"
              isAnimationActive={false}
            />

            {/* Projected line — dashed, lighter */}
            {hasProjected && (
              <Line
                type="monotone"
                dataKey="projected"
                name="Projected"
                stroke={PROJECTED_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: PROJECTED_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: PROJECTED_COLOR }}
                connectNulls
                legendType="none"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="block h-0.5 w-4 rounded" style={{ backgroundColor: HISTORICAL_COLOR }} />
          <span className="text-[11px] text-muted-foreground">Historical</span>
        </div>
        {hasProjected && (
          <div className="flex items-center gap-1.5">
            <svg width="16" height="2" aria-hidden="true">
              <line
                x1="0" y1="1" x2="16" y2="1"
                stroke={PROJECTED_COLOR}
                strokeWidth="2"
                strokeDasharray="5 3"
              />
            </svg>
            <span className="text-[11px] text-muted-foreground">Projected</span>
          </div>
        )}
        {hasConfidence && hasProjected && (
          <div className="flex items-center gap-1.5">
            <span
              className="block h-3 w-4 rounded-sm opacity-30"
              style={{ backgroundColor: HISTORICAL_COLOR }}
            />
            <span className="text-[11px] text-muted-foreground">Confidence band</span>
          </div>
        )}
      </div>
    </div>
  )
}
