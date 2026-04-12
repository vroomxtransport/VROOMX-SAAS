'use client'

/**
 * Shared chart theme for VroomX recharts-based trend charts.
 *
 * Exports three things:
 *
 * 1. Spreadable prop objects — `CHART_GRID_PROPS`, `CHART_X_AXIS_PROPS`,
 *    `CHART_Y_AXIS_PROPS`, `CHART_TOOLTIP_CURSOR`. These are spread onto
 *    real recharts primitives at the call site. They are NOT wrapper
 *    components on purpose: recharts inspects `React.Children` by component
 *    type (`CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`) and silently
 *    drops anything it doesn't recognise. Wrappers break that matching.
 *
 * 2. Pure-SVG helper components — `ChartGradientDefs`, `AreaGradient`,
 *    `ChartGlowFilter`. Safe to wrap because they emit leaf `<defs>`,
 *    `<linearGradient>`, and `<filter>` elements which recharts does not
 *    introspect. Each requires a caller-supplied `id` string so multiple
 *    charts on one page can namespace their SVG ids (see the `useId()`
 *    pattern in `forecast-chart.tsx` for multi-instance safety).
 *
 * 3. `GlassTooltip` and `ChartLegendSwatches` — pre-styled React components
 *    for the tooltip body and custom swatch legend.
 *
 * The visual language is specified in detail in
 * `/Users/reepsy/.claude/plans/jazzy-stirring-honey.md`.
 */

import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Colors — mirrors CSS variables in src/app/globals.css
// ---------------------------------------------------------------------------
// We hard-code hex values here instead of `var(--chart-1)` because
// `stopColor` inside `<linearGradient>` does not reliably resolve CSS
// variables in SSR or static SVG export paths. CSS vars are still used
// wherever recharts props accept them cleanly (stroke, grid, axis).
//
// Keep this object in sync with `globals.css` lines 117–121 and 133–139.
export const CHART_COLORS = {
  brand: '#192334', // --chart-1 / --brand
  amber: '#f59e0b', // --chart-2
  emerald: '#10b981', // --chart-3
  blue: '#3b82f6', // --chart-4
  violet: '#8b5cf6', // --chart-5
  rose: '#f43f5e', // expenses accent
  muted: '#9ca3af', // comparison / previous-period
} as const

export type ChartColorKey = keyof typeof CHART_COLORS

// ---------------------------------------------------------------------------
// Spreadable prop objects (for real recharts primitives)
// ---------------------------------------------------------------------------

export const CHART_GRID_PROPS = {
  strokeDasharray: '4 4',
  stroke: 'var(--border-subtle)',
  strokeOpacity: 0.5,
  vertical: false,
} as const

export const CHART_X_AXIS_PROPS = {
  tick: { fontSize: 11, fill: 'var(--muted-foreground)', fillOpacity: 0.75 },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

export const CHART_Y_AXIS_PROPS = {
  tick: { fontSize: 11, fill: 'var(--muted-foreground)', fillOpacity: 0.75 },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const

export const CHART_TOOLTIP_CURSOR = {
  stroke: 'var(--border-subtle)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
} as const

// ---------------------------------------------------------------------------
// SVG helper components
// ---------------------------------------------------------------------------

/**
 * Wraps its children in a `<defs>` element. Must be a direct child of a
 * recharts chart (`AreaChart`, `ComposedChart`, `LineChart`) so the SVG
 * elements inside get hoisted into the chart's `<svg>` tree.
 */
export function ChartGradientDefs({ children }: { children: ReactNode }) {
  return <defs>{children}</defs>
}

interface AreaGradientProps {
  id: string
  color: string
  topOpacity?: number
  midOffset?: number
  midOpacity?: number
}

/**
 * Vertical linear gradient (y1=0 → y2=1). Top-to-bottom fade from
 * `topOpacity` through a mid stop down to 0. Default values match the
 * "atmospheric" density of the reference.
 */
export function AreaGradient({
  id,
  color,
  topOpacity = 0.35,
  midOffset = 0.35,
  midOpacity = 0.15,
}: AreaGradientProps) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={topOpacity} />
      <stop offset={`${Math.round(midOffset * 100)}%`} stopColor={color} stopOpacity={midOpacity} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

interface ChartGlowFilterProps {
  id: string
  color: string
  stdDeviation?: number
  floodOpacity?: number
}

/**
 * Soft atmospheric glow for hero lines / areas. Apply via
 * `filter="url(#<id>)"` on the `<Area>` or `<Line>`.
 *
 * DO NOT apply to dashed strokes — `feGaussianBlur` blurs the dash gaps
 * into halo dots rather than a clean halo. Glow is hero-series-only.
 */
export function ChartGlowFilter({
  id,
  color,
  stdDeviation = 3,
  floodOpacity = 0.3,
}: ChartGlowFilterProps) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation={stdDeviation} result="blur" />
      <feFlood floodColor={color} floodOpacity={floodOpacity} result="color" />
      <feComposite in="color" in2="blur" operator="in" result="coloredBlur" />
      <feMerge>
        <feMergeNode in="coloredBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

// ---------------------------------------------------------------------------
// GlassTooltip — promoted from revenue-chart.tsx, generalised
// ---------------------------------------------------------------------------

export interface GlassTooltipPayloadItem {
  value: number
  dataKey: string | number
  color?: string
  name?: string
  stroke?: string
}

export interface GlassTooltipProps {
  active?: boolean
  payload?: GlassTooltipPayloadItem[]
  label?: string | number
  labelFormatter?: (label: string | number) => string
  valueFormatter: (value: number, dataKey: string) => string
  seriesLabels?: Record<string, string>
}

/**
 * Glass-panel tooltip with:
 *  - `.glass-panel rounded-lg border border-border-subtle` backing
 *  - 2px top border in the first payload's stroke color (visual link to
 *    the hovered line)
 *  - 12px muted label, 13px tabular-nums values
 *
 * Callers supply `valueFormatter` (currency / percent / rate / etc.) and
 * optionally `seriesLabels` mapping `dataKey` → display name.
 */
export function GlassTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  seriesLabels,
}: GlassTooltipProps) {
  if (!active || !payload?.length) return null

  const accentColor = payload[0]?.stroke ?? payload[0]?.color ?? CHART_COLORS.brand
  const displayLabel =
    label !== undefined
      ? labelFormatter
        ? labelFormatter(label)
        : String(label)
      : ''

  return (
    <div
      className="glass-panel rounded-lg border border-border-subtle px-4 py-3 shadow-lg min-w-[160px]"
      style={{ borderTop: `2px solid ${accentColor}` }}
    >
      {displayLabel && (
        <p className="text-xs font-medium text-muted-foreground mb-2">{displayLabel}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const dataKey = String(item.dataKey)
          // seriesLabels is a caller-supplied literal map (typed Record<string, string>)
          // and dataKey is a recharts-internal string from the payload — no injection surface.
          // eslint-disable-next-line security/detect-object-injection
          const name = seriesLabels?.[dataKey] ?? item.name ?? dataKey
          const swatchColor = item.stroke ?? item.color ?? CHART_COLORS.brand
          return (
            <div
              key={`${dataKey}-${idx}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: swatchColor }}
                />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
              <span className="text-[13px] font-semibold tabular-nums text-foreground">
                {valueFormatter(item.value, dataKey)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ChartLegendSwatches — custom soft legend (rendered outside recharts)
// ---------------------------------------------------------------------------

export interface ChartLegendSwatchItem {
  label: string
  color: string
  variant?: 'solid' | 'dashed'
}

interface ChartLegendSwatchesProps {
  items: ChartLegendSwatchItem[]
  className?: string
}

/**
 * Flex row of 10×3 rounded-sm color swatches + 11px labels. Rendered
 * *outside* `<ResponsiveContainer>` in a sibling div so it doesn't steal
 * from the chart's height.
 */
export function ChartLegendSwatches({
  items,
  className = '',
}: ChartLegendSwatchesProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`.trim()}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-[3px] w-[10px] rounded-sm"
            style={{
              backgroundColor: item.variant === 'dashed' ? 'transparent' : item.color,
              ...(item.variant === 'dashed'
                ? {
                    backgroundImage: `repeating-linear-gradient(to right, ${item.color} 0 3px, transparent 3px 6px)`,
                  }
                : null),
            }}
          />
          <span className="text-[11px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
