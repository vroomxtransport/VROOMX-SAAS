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
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MonthlyKPITrend } from '@/lib/queries/financials'
import {
  AreaGradient,
  CHART_COLORS,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_CURSOR,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  ChartGlowFilter,
  ChartGradientDefs,
  ChartLegendSwatches,
  GlassTooltip,
  type GlassTooltipProps,
} from '@/components/charts/chart-theme'

type TrendView = 'per_mile' | 'margins'

interface KPITrendChartProps {
  data: MonthlyKPITrend[]
}

const SERIES_LABELS = {
  rpm: 'RPM',
  cpm: 'CPM',
  ppm: 'PPM',
  grossMargin: 'Gross Margin',
  netMargin: 'Net Margin',
  operatingRatio: 'Op. Ratio',
} as const

export function KPITrendChart({ data }: KPITrendChartProps) {
  const [view, setView] = useState<TrendView>('per_mile')

  const hasPerMileData = data.some((d) => d.rpm !== null)

  // view is baked into every gradient/filter id so tab-switch remounts get a
  // disjoint SVG id namespace (prevents stale `fill="url(#...)"` references).
  const idPrefix = `kpi-${view}`

  const renderTooltip = useCallback(
    (props: Record<string, unknown>) => {
      const tooltipProps = props as unknown as Omit<
        GlassTooltipProps,
        'valueFormatter' | 'seriesLabels'
      >
      return (
        <GlassTooltip
          {...tooltipProps}
          valueFormatter={(v) =>
            view === 'per_mile'
              ? `$${Number(v).toFixed(2)}/mi`
              : `${Number(v).toFixed(1)}%`
          }
          seriesLabels={SERIES_LABELS}
        />
      )
    },
    [view],
  )

  const legendItems =
    view === 'per_mile'
      ? [
          { label: 'RPM', color: CHART_COLORS.blue },
          { label: 'CPM', color: CHART_COLORS.rose },
          { label: 'PPM', color: CHART_COLORS.emerald },
        ]
      : [
          { label: 'Gross Margin', color: CHART_COLORS.blue },
          { label: 'Net Margin', color: CHART_COLORS.emerald },
          { label: 'Op. Ratio', color: CHART_COLORS.amber, variant: 'dashed' as const },
        ]

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
              <ChartGradientDefs>
                {view === 'per_mile' && <AreaGradient id={`${idPrefix}-rpm`} color={CHART_COLORS.blue} />}
                {view === 'per_mile' && <AreaGradient id={`${idPrefix}-cpm`} color={CHART_COLORS.rose} />}
                {view === 'per_mile' && <AreaGradient id={`${idPrefix}-ppm`} color={CHART_COLORS.emerald} />}
                {view === 'per_mile' && <ChartGlowFilter id={`${idPrefix}-glow-rpm`} color={CHART_COLORS.blue} />}
                {view === 'margins' && <AreaGradient id={`${idPrefix}-gross`} color={CHART_COLORS.blue} />}
                {view === 'margins' && <AreaGradient id={`${idPrefix}-net`} color={CHART_COLORS.emerald} />}
                {view === 'margins' && <ChartGlowFilter id={`${idPrefix}-glow-gross`} color={CHART_COLORS.blue} />}
              </ChartGradientDefs>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="month" {...CHART_X_AXIS_PROPS} />
              <YAxis
                tickFormatter={(v: number) =>
                  view === 'per_mile' ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`
                }
                {...CHART_Y_AXIS_PROPS}
              />
              <Tooltip content={renderTooltip} cursor={CHART_TOOLTIP_CURSOR} />

              {view === 'per_mile' ? (
                <>
                  <Area type="monotone" dataKey="rpm" name="RPM" stroke="none" fill={`url(#${idPrefix}-rpm)`} connectNulls legendType="none" />
                  <Area type="monotone" dataKey="cpm" name="CPM" stroke="none" fill={`url(#${idPrefix}-cpm)`} connectNulls legendType="none" />
                  <Area type="monotone" dataKey="ppm" name="PPM" stroke="none" fill={`url(#${idPrefix}-ppm)`} connectNulls legendType="none" />
                  <Line
                    type="monotone"
                    dataKey="rpm"
                    name="RPM"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    filter={`url(#${idPrefix}-glow-rpm)`}
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.blue, stroke: 'white', strokeWidth: 2 }}
                    connectNulls
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="cpm"
                    name="CPM"
                    stroke={CHART_COLORS.rose}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.rose, stroke: 'white', strokeWidth: 2 }}
                    connectNulls
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="ppm"
                    name="PPM"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.emerald, stroke: 'white', strokeWidth: 2 }}
                    connectNulls
                    legendType="none"
                  />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="none" fill={`url(#${idPrefix}-gross)`} legendType="none" />
                  <Area type="monotone" dataKey="netMargin" name="Net Margin" stroke="none" fill={`url(#${idPrefix}-net)`} legendType="none" />
                  <Line
                    type="monotone"
                    dataKey="grossMargin"
                    name="Gross Margin"
                    stroke={CHART_COLORS.blue}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    filter={`url(#${idPrefix}-glow-gross)`}
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.blue, stroke: 'white', strokeWidth: 2 }}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="netMargin"
                    name="Net Margin"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.emerald, stroke: 'white', strokeWidth: 2 }}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="operatingRatio"
                    name="Op. Ratio"
                    stroke={CHART_COLORS.amber}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, fill: CHART_COLORS.amber, stroke: 'white', strokeWidth: 2 }}
                    legendType="none"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartLegendSwatches items={legendItems} className="mt-2 px-1" />
    </div>
  )
}
