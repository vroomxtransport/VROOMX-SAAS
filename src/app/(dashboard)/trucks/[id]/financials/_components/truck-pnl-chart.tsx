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

export interface MonthlyPnlPoint {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface TruckPnlChartProps {
  data: MonthlyPnlPoint[]
}

export function TruckPnlChart({ data }: TruckPnlChartProps) {
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
          <div
            className="h-[240px]"
            role="img"
            aria-label={`12-month revenue and expense trend chart. Total revenue ${totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}, total expenses ${totalExpenses.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}, net profit ${totalProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <ChartGradientDefs>
                  <AreaGradient id="truck-pnl-rev" color={CHART_COLORS.brand} />
                  <AreaGradient id="truck-pnl-exp" color={CHART_COLORS.rose} />
                  <ChartGlowFilter id="truck-pnl-glow" color={CHART_COLORS.brand} />
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
                  fill="url(#truck-pnl-rev)"
                  filter="url(#truck-pnl-glow)"
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
                  fill="url(#truck-pnl-exp)"
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_COLORS.rose, stroke: 'white', strokeWidth: 2 }}
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
