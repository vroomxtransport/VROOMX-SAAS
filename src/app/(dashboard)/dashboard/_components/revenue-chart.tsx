'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

type Period = '7D' | '30D' | '90D'

// Simple seeded PRNG to avoid hydration mismatch (Math.random differs server vs client)
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Generate sample revenue data with deterministic values
function generateSampleData(days: number) {
  const data: { date: string; revenue: number }[] = []
  const rand = seededRandom(days * 42)
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: Math.floor(3000 + rand() * 4000),
    })
  }
  return data
}

const PERIOD_DATA: Record<Period, { date: string; revenue: number }[]> = {
  '7D': generateSampleData(7),
  '30D': generateSampleData(30),
  '90D': generateSampleData(90),
}

function computeStats(data: { date: string; revenue: number }[]) {
  const total = data.reduce((s, d) => s + d.revenue, 0)
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  const peak = data.reduce(
    (best, d) => (d.revenue > best.revenue ? d : best),
    data[0] ?? { date: '—', revenue: 0 }
  )
  return { total, avg, peakDay: peak.date }
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>('30D')
  const data = PERIOD_DATA[period]
  const { total, avg, peakDay } = computeStats(data)

  return (
    <div className="widget-card-primary h-full flex flex-col">
      {/* Header */}
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-[var(--brand)]" />
          Revenue
        </span>

        {/* Period selector */}
        <div className="flex rounded-lg bg-muted p-0.5">
          {(['7D', '30D', '90D'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                period === p
                  ? 'bg-brand text-white shadow-[0_1px_4px_rgba(251,114,50,0.3)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7232" stopOpacity={0.25} />
                <stop offset="45%" stopColor="#f59e0b" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#fb7232" stopOpacity={0} />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#7a7a7a' }}
              tickLine={false}
              axisLine={false}
              interval={period === '7D' ? 0 : period === '30D' ? 4 : 13}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#7a7a7a' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#fb7232"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              filter="url(#glow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer stats */}
      <div className="flex gap-3 mt-3 pt-3 border-t border-border-subtle">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Daily Avg</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${avg.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Peak Day</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {peakDay}
          </p>
        </div>
      </div>
    </div>
  )
}
