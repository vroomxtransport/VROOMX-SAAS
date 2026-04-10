'use client'

import { useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface MonthlyPnlPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface TruckPnlChartProps {
  data: MonthlyPnlPoint[]
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.name}</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
            ${Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export function TruckPnlChart({ data }: TruckPnlChartProps) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const renderTooltip = useCallback((props: any) => <ChartTooltip {...(props as ChartTooltipProps)} />, [])

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0)
  const totalProfit = totalRevenue - totalExpenses

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          12-Month Trend
        </h3>
      </div>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No activity in the last 12 months
        </p>
      ) : (
        <>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="truckRevenueGradientFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#192334" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#192334" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="truckExpensesGradientFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
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
                <Tooltip content={renderTooltip} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#192334"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="url(#truckRevenueGradientFill)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="url(#truckExpensesGradientFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand" />
                <p className="text-xs text-muted-foreground">Revenue</p>
              </div>
              <p className="text-base font-semibold tabular-nums text-foreground">
                ${totalRevenue.toLocaleString()}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <p className="text-xs text-muted-foreground">Expenses</p>
              </div>
              <p className="text-base font-semibold tabular-nums text-foreground">
                ${totalExpenses.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Profit</p>
              <p
                className={
                  totalProfit >= 0
                    ? 'text-base font-semibold tabular-nums text-emerald-600'
                    : 'text-base font-semibold tabular-nums text-rose-600'
                }
              >
                ${totalProfit.toLocaleString()}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
