'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchMonthlyKPITrend } from '@/lib/queries/financials'
import { linearForecast, type DataPoint, type ForecastResult } from '@/lib/financial/forecasting'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  }
  return `$${Math.round(value)}`
}

function formatMonth(period: string): string {
  const [yearStr, monthStr] = period.split('-')
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIdx = parseInt(monthStr, 10) - 1
  const monthName = monthNames[monthIdx] ?? monthStr
  return `${monthName} '${yearStr.slice(2)}`
}

interface ChartDataPoint {
  period: string
  label: string
  historical: number | null
  projected: number | null
  upper: number | null
  lower: number | null
}

function buildChartData(forecast: ForecastResult): ChartDataPoint[] {
  const points: ChartDataPoint[] = []

  // Historical data points
  for (const dp of forecast.historical) {
    points.push({
      period: dp.period,
      label: formatMonth(dp.period),
      historical: dp.value,
      projected: null,
      upper: null,
      lower: null,
    })
  }

  // Bridge: last historical point also becomes first projected point
  if (forecast.historical.length > 0 && forecast.projected.length > 0) {
    const last = forecast.historical[forecast.historical.length - 1]
    const lastPoint = points[points.length - 1]
    if (lastPoint) {
      lastPoint.projected = last.value
      lastPoint.upper = last.value
      lastPoint.lower = last.value
    }
  }

  // Projected data points with confidence bands
  for (let i = 0; i < forecast.projected.length; i++) {
    const proj = forecast.projected[i]
    const up = forecast.confidence.upper[i]
    const lo = forecast.confidence.lower[i]

    points.push({
      period: proj.period,
      label: formatMonth(proj.period),
      historical: null,
      projected: proj.value,
      upper: up?.value ?? null,
      lower: lo?.value ?? null,
    })
  }

  return points
}

function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const historical = payload.find((p) => p.dataKey === 'historical')
  const projected = payload.find((p) => p.dataKey === 'projected')

  return (
    <div className="glass-panel rounded-xl px-4 py-3 shadow-lg border border-border-subtle min-w-[140px]">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      {historical?.value != null && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#192334]" />
            <span className="text-xs text-muted-foreground">Actual</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrencyCompact(historical.value)}
          </span>
        </div>
      )}
      {projected?.value != null && (
        <div className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-brand" />
            <span className="text-xs text-muted-foreground">Projected</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatCurrencyCompact(projected.value)}
          </span>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Revenue Forecast
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center animate-pulse">
        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
      </div>
    </div>
  )
}

export function RevenueForecast() {
  const supabase = createClient()

  const { data: kpiTrend = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'revenue-forecast'],
    queryFn: () => fetchMonthlyKPITrend(supabase, 12),
    staleTime: 120_000,
  })

  const forecast = useMemo((): ForecastResult | null => {
    if (kpiTrend.length < 3) return null

    const dataPoints: DataPoint[] = kpiTrend.map((m) => ({
      period: m.month,
      value: m.revenue,
    }))

    return linearForecast(dataPoints, 3)
  }, [kpiTrend])

  const chartData = useMemo(() => {
    if (!forecast) return []
    return buildChartData(forecast)
  }, [forecast])

  if (isLoading) return <LoadingSkeleton />

  const TrendIcon =
    forecast?.trend === 'up'
      ? TrendingUp
      : forecast?.trend === 'down'
        ? TrendingDown
        : Minus

  const trendColor =
    forecast?.trend === 'up'
      ? 'text-emerald-600'
      : forecast?.trend === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground'

  const hasData = chartData.length > 0

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Revenue Forecast
        </span>
        {forecast && (
          <div className="flex items-center gap-1.5">
            <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
            <span className={cn('text-xs font-semibold tabular-nums', trendColor)}>
              {forecast.avgGrowthRate > 0 ? '+' : ''}
              {forecast.avgGrowthRate.toFixed(1)}%/mo
            </span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <p className="text-sm">Not enough data to forecast</p>
          <p className="text-xs">Need at least 3 months of revenue</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastConfidenceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7232" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#fb7232" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                dy={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrencyCompact(v)}
                width={48}
              />

              <Tooltip
                content={(props: Record<string, unknown>) => (
                  <ForecastTooltip
                    {...(props as {
                      active?: boolean
                      payload?: Array<{ value: number | null; dataKey: string }>
                      label?: string
                    })}
                  />
                )}
                cursor={{
                  stroke: 'var(--border-subtle)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              {/* Confidence band area */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="url(#forecastConfidenceFill)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="var(--surface)"
                fillOpacity={1}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />

              {/* Historical revenue line */}
              <Line
                type="monotone"
                dataKey="historical"
                stroke="#192334"
                strokeWidth={2.5}
                strokeLinecap="round"
                dot={{ r: 2, fill: '#192334', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#192334', stroke: 'white', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Projected revenue line */}
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#fb7232"
                strokeWidth={2.5}
                strokeDasharray="8 4"
                strokeLinecap="round"
                dot={{ r: 2, fill: '#fb7232', strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#fb7232', stroke: 'white', strokeWidth: 2 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
