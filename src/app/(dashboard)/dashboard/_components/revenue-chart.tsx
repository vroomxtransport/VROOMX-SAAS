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

function computeStats(data: { revenue: number }[]) {
  const total = data.reduce((s, d) => s + d.revenue, 0)
  const avg = data.length > 0 ? Math.round(total / data.length) : 0
  return { total, avg }
}

export function RevenueChart() {
  const [period, setPeriod] = useState<Period>('30D')
  const data = PERIOD_DATA[period]
  const { total, avg } = computeStats(data)

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Revenue</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(['7D', '30D', '90D'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                period === p
                  ? 'bg-surface shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7232" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#fb7232" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e7e4" vertical={false} />
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
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-6 mt-3 pt-3 border-t border-border-subtle">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${total.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Daily Avg</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${avg.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
