'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
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

export function KPITrendChart({ data }: KPITrendChartProps) {
  const [view, setView] = useState<TrendView>('per_mile')

  const hasPerMileData = data.some((d) => d.rpm !== null)

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
            <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                formatter={(value, name) => {
                  if (value == null) return ['N/A', name]
                  const v = Number(value)
                  return view === 'per_mile'
                    ? [`$${v.toFixed(2)}/mi`, name]
                    : [`${v.toFixed(1)}%`, name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />

              {view === 'per_mile' ? (
                <>
                  <Line type="monotone" dataKey="rpm" name="RPM" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="cpm" name="CPM" stroke="#f43f5e" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="ppm" name="PPM" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netMargin" name="Net Margin" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="operatingRatio" name="Op. Ratio" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
