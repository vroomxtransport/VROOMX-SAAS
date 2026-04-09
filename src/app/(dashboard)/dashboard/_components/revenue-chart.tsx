'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDailyRevenue } from '@/lib/queries/financials'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Zap, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Period = '7D' | '30D' | '90D'

const PERIOD_DAYS: Record<Period, number> = { '7D': 7, '30D': 30, '90D': 90 }

function computeStats(data: { revenue: number; prevRevenue: number }[]) {
  const total = data.reduce((s, d) => s + d.revenue, 0)
  const prevTotal = data.reduce((s, d) => s + d.prevRevenue, 0)
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0
  const peak = data.reduce((max, d) => Math.max(max, d.revenue), 0)
  return { total, avg, change, peak }
}

function formatCurrency(value: number, compact = false): string {
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  }
  return `$${value.toLocaleString()}`
}

function GlassTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload?.length) return null

  const current = payload.find((p) => p.dataKey === 'revenue')
  const prev = payload.find((p) => p.dataKey === 'prevRevenue')

  return (
    <div className="glass-panel rounded-xl px-4 py-3 shadow-lg border border-border-subtle min-w-[160px]">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#192334]" />
            <span className="text-xs text-muted-foreground">Current</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {current ? formatCurrency(current.value) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#192334]/30" />
            <span className="text-xs text-muted-foreground">Previous</span>
          </div>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {prev ? formatCurrency(prev.value) : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

function ActiveDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="#192334" opacity={0.08}>
        <animate attributeName="r" from="10" to="18" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.12" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={8} fill="#192334" opacity={0.15} />
      <circle cx={cx} cy={cy} r={5} fill="#192334" stroke="white" strokeWidth={2.5} />
    </g>
  )
}

function SmallDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props
  if (cx == null || cy == null) return null
  return <circle cx={cx} cy={cy} r={2} fill="#192334" opacity={0.6} />
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>('30D')
  const supabase = createClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'daily-revenue', period],
    queryFn: () => fetchDailyRevenue(supabase, PERIOD_DAYS[period]),
    staleTime: 60_000,
  })

  const { total, avg, change, peak } = computeStats(data)
  const isPositive = change >= 0
  const hasData = data.some((d) => d.revenue > 0)

  const tickInterval = period === '7D' ? 0 : period === '30D' ? 6 : 14

  const renderTooltip = useCallback((props: Record<string, unknown>) => (
    <GlassTooltip {...props as { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }} />
  ), [])

  return (
    <div className="widget-card-primary h-full flex flex-col">
      {/* Header with hero stat */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="widget-title">
              <span className="widget-accent-dot bg-[var(--brand)]" />
              Revenue
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight">
              {formatCurrency(total)}
            </p>
            {change !== 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                  isPositive
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-500/10 text-red-600'
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">vs previous period</p>
        </div>

        {/* Period selector */}
        <div className="flex rounded-lg bg-muted p-0.5 shrink-0">
          {(['7D', '30D', '90D'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                period === p
                  ? 'bg-brand text-white shadow-[0_1px_4px_rgba(25,35,52,0.3)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 mt-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="h-8 w-8 opacity-40" />
            <p className="text-sm">No revenue data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#192334" />
                  <stop offset="50%" stopColor="#2a3a4f" />
                  <stop offset="100%" stopColor="#192334" />
                </linearGradient>
                <linearGradient id="revGradientMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#192334" stopOpacity={0.4} />
                  <stop offset="35%" stopColor="#2a3a4f" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#192334" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="revGradientPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feFlood floodColor="#192334" floodOpacity="0.3" result="color" />
                  <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-subtle)"
                vertical={false}
                opacity={0.6}
              />

              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
                dy={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatCurrency(v, true)}
                width={48}
              />

              <ReferenceLine
                y={avg}
                stroke="var(--border-subtle)"
                strokeDasharray="6 4"
                strokeOpacity={0.8}
              />

              <Tooltip
                content={renderTooltip}
                cursor={{
                  stroke: 'var(--border-subtle)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />

              <Area
                type="natural"
                dataKey="prevRevenue"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.35}
                strokeLinecap="round"
                fill="url(#revGradientPrev)"
                dot={false}
                activeDot={false}
              />

              <Area
                type="natural"
                dataKey="revenue"
                stroke="url(#revStrokeGradient)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#revGradientMain)"
                filter="url(#lineGlow)"
                dot={period === '7D' ? <SmallDot /> : false}
                activeDot={<ActiveDot />}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer mini-stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border-subtle">
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <DollarSign className="h-3.5 w-3.5 text-brand shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg/Day</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(avg)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatCurrency(peak)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Period</p>
            <p className="text-sm font-semibold text-foreground">
              {period === '7D' ? '7 Days' : period === '30D' ? '30 Days' : '90 Days'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
