'use client'

import { useState, useCallback } from 'react'
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
import {
  AreaGradient,
  CHART_COLORS,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_CURSOR,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  ChartGlowFilter,
  ChartGradientDefs,
  GlassTooltip,
  type GlassTooltipProps,
} from '@/components/charts/chart-theme'

type Period = '3M' | '6M'

interface RevenueExpensesChartProps {
  data: MonthlyRevenue[]
}

export function RevenueExpensesChart({ data }: RevenueExpensesChartProps) {
  const [period, setPeriod] = useState<Period>('6M')
  const displayData = period === '3M' ? data.slice(-3) : data

  const totalRevenue = displayData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = displayData.reduce((s, d) => s + d.expenses, 0)

  const renderTooltip = useCallback(
    (props: Record<string, unknown>) => {
      const tooltipProps = props as unknown as Omit<
        GlassTooltipProps,
        'valueFormatter' | 'seriesLabels'
      >
      return (
        <GlassTooltip
          {...tooltipProps}
          valueFormatter={(v) => `$${Number(v).toLocaleString()}`}
          seriesLabels={{ revenue: 'Revenue', expenses: 'Expenses' }}
        />
      )
    },
    [],
  )

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
            <ChartGradientDefs>
              <AreaGradient id="revexp-rev" color={CHART_COLORS.brand} />
              <AreaGradient id="revexp-exp" color={CHART_COLORS.rose} />
              <ChartGlowFilter id="revexp-glow" color={CHART_COLORS.brand} />
            </ChartGradientDefs>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis dataKey="month" {...CHART_X_AXIS_PROPS} />
            <YAxis
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              {...CHART_Y_AXIS_PROPS}
            />
            <Tooltip content={renderTooltip} cursor={CHART_TOOLTIP_CURSOR} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={CHART_COLORS.brand}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="url(#revexp-rev)"
              filter="url(#revexp-glow)"
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.brand, stroke: 'white', strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke={CHART_COLORS.rose}
              strokeWidth={2}
              strokeLinecap="round"
              fill="url(#revexp-exp)"
              dot={false}
              activeDot={{ r: 4, fill: CHART_COLORS.rose, stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-6 mt-3 pt-3 border-t border-border-subtle">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#192334]" />
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
