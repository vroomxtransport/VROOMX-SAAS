'use client'

import { useState, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MonthlyKPITrend } from '@/lib/queries/financials'

type TrendView = 'per_mile' | 'margins'

interface KPITrendChartProps {
  data: MonthlyKPITrend[]
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  view: TrendView
}

function TrendTooltip({ active, payload, label, view }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry) => {
        if (entry.value == null) return null
        const formatted = view === 'per_mile'
          ? `$${Number(entry.value).toFixed(2)}/mi`
          : `${Number(entry.value).toFixed(1)}%`
        return (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="text-xs font-semibold tabular-nums text-foreground ml-auto">
              {formatted}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function KPITrendChart({ data }: KPITrendChartProps) {
  const [view, setView] = useState<TrendView>('per_mile')

  const hasPerMileData = data.some((d) => d.rpm !== null)

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const renderTooltip = useCallback(
    (props: any) => <TrendTooltip {...(props as CustomTooltipProps)} view={view} />,
    [view]
  )

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">KPI Trends</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          {([
            { value: 'per_mile' as const, label: '$/Mile' },
            { value: 'margins' as const, label: 'Margins' },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setView(tab.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                view === tab.value
                  ? 'bg-surface shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px]">
        {view === 'per_mile' && !hasPerMileData ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Add distance miles to orders to see per-mile trends</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                {view === 'per_mile' ? (
                  <>
                    <linearGradient id="rpmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="cpmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="ppmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </>
                ) : (
                  <>
                    <linearGradient id="grossMarginAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="netMarginAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e4" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#7a7a7a' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#7a7a7a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  view === 'per_mile' ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`
                }
              />
              <Tooltip content={renderTooltip} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />

              {view === 'per_mile' ? (
                <>
                  <Area type="monotone" dataKey="rpm" name="RPM" stroke="none" fill="url(#rpmAreaGrad)" connectNulls />
                  <Area type="monotone" dataKey="cpm" name="CPM" stroke="none" fill="url(#cpmAreaGrad)" connectNulls legendType="none" />
                  <Area type="monotone" dataKey="ppm" name="PPM" stroke="none" fill="url(#ppmAreaGrad)" connectNulls legendType="none" />
                  <Line type="monotone" dataKey="rpm" name="RPM" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} connectNulls legendType="none" />
                  <Line type="monotone" dataKey="cpm" name="CPM" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} connectNulls />
                  <Line type="monotone" dataKey="ppm" name="PPM" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} connectNulls />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="none" fill="url(#grossMarginAreaGrad)" legendType="none" />
                  <Area type="monotone" dataKey="netMargin" name="Net Margin" stroke="none" fill="url(#netMarginAreaGrad)" legendType="none" />
                  <Line type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="netMargin" name="Net Margin" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="operatingRatio" name="Op. Ratio" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} strokeDasharray="5 5" />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
