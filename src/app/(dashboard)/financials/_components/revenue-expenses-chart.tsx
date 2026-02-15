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
import type { MonthlyRevenue } from '@/lib/queries/financials'

type Period = '3M' | '6M'

interface RevenueExpensesChartProps {
  data: MonthlyRevenue[]
}

export function RevenueExpensesChart({ data }: RevenueExpensesChartProps) {
  const [period, setPeriod] = useState<Period>('6M')
  const displayData = period === '3M' ? data.slice(-3) : data

  const totalRevenue = displayData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = displayData.reduce((s, d) => s + d.expenses, 0)

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Revenue vs Expenses</h3>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(['3M', '6M'] as Period[]).map((p) => (
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

      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7232" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#fb7232" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
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
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value) => [`$${Number(value).toLocaleString()}`]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#fb7232"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#expensesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-6 mt-3 pt-3 border-t border-border-subtle">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#fb7232]" />
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
            <p className="text-xs text-muted-foreground">Expenses</p>
          </div>
          <p className="text-base font-semibold tabular-nums text-foreground">
            ${totalExpenses.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
