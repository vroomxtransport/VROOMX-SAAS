'use client'

import { cn } from '@/lib/utils'
import type { ExpenseSummary } from '@/lib/queries/truck-expense-ledger'
import type { TruckUtilization } from '@/lib/queries/fleet-utilization'

interface TruckPnlKpisProps {
  utilization: TruckUtilization | null
  summary: ExpenseSummary | null
  /** Fleet averages for the "vs Fleet Avg" strip (null = no comparison available). */
  fleetAvgRpm: number | null
  fleetAvgProfitPerMile: number | null
  fleetAvgUtilization: number
}

function fmt$(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPerMile(val: number | null): string {
  if (val === null) return '—'
  return `$${val.toFixed(2)}`
}

function fmtPct(val: number | null): string {
  if (val === null || Number.isNaN(val)) return '—'
  return `${val.toFixed(1)}%`
}

function fmtNumber(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type Tone = 'neutral' | 'positive' | 'negative' | 'warning'

function toneClass(tone: Tone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-600'
    case 'negative':
      return 'text-rose-600'
    case 'warning':
      return 'text-amber-600'
    default:
      return 'text-foreground'
  }
}

interface Metric {
  label: string
  value: string
  tone?: Tone
  delta?: { label: string; direction: 'up' | 'down' | 'flat' }
  helper?: string
}

export function TruckPnlKpis({
  utilization,
  summary,
  fleetAvgRpm,
  fleetAvgProfitPerMile,
  fleetAvgUtilization,
}: TruckPnlKpisProps) {
  // Prefer ledger totals for expenses (unified across all 4 source tables);
  // fall back to utilization.expenses (trip-table only) when summary is null.
  const revenue = utilization?.revenue ?? 0
  const expenses = summary?.total ?? utilization?.expenses ?? 0
  const profit = revenue - expenses
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null

  const rpm = utilization?.revenuePerMile ?? null
  const ppm = utilization?.profitPerMile ?? null
  const cpm = utilization && utilization.totalMiles > 0 ? expenses / utilization.totalMiles : null
  const utilizationPct = utilization?.utilizationPct ?? 0
  const activeDays = utilization?.activeDays ?? 0

  // vs-fleet-avg deltas — a direction only, not a percentage (keeps the strip clean).
  const rpmDelta: Metric['delta'] =
    rpm !== null && fleetAvgRpm !== null
      ? {
          label: `vs $${fleetAvgRpm.toFixed(2)} avg`,
          direction: rpm > fleetAvgRpm ? 'up' : rpm < fleetAvgRpm ? 'down' : 'flat',
        }
      : undefined

  const ppmDelta: Metric['delta'] =
    ppm !== null && fleetAvgProfitPerMile !== null
      ? {
          label: `vs $${fleetAvgProfitPerMile.toFixed(2)} avg`,
          direction: ppm > fleetAvgProfitPerMile ? 'up' : ppm < fleetAvgProfitPerMile ? 'down' : 'flat',
        }
      : undefined

  const utilDelta: Metric['delta'] = fleetAvgUtilization > 0
    ? {
        label: `vs ${fleetAvgUtilization.toFixed(0)}% avg`,
        direction:
          utilizationPct > fleetAvgUtilization
            ? 'up'
            : utilizationPct < fleetAvgUtilization
              ? 'down'
              : 'flat',
      }
    : undefined

  const primary: Metric[] = [
    {
      label: 'Revenue',
      value: fmt$(revenue),
      tone: 'neutral',
    },
    {
      label: 'Expenses',
      value: fmt$(expenses),
      tone: 'neutral',
    },
    {
      label: 'Net Profit',
      value: fmt$(profit),
      tone: profit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Margin',
      value: fmtPct(marginPct),
      tone:
        marginPct === null
          ? 'neutral'
          : marginPct >= 20
            ? 'positive'
            : marginPct >= 10
              ? 'warning'
              : 'negative',
    },
  ]

  const secondary: Metric[] = [
    {
      label: 'RPM',
      value: fmtPerMile(rpm),
      helper: 'per mile',
      delta: rpmDelta,
    },
    {
      label: 'CPM',
      value: fmtPerMile(cpm),
      helper: 'per mile',
    },
    {
      label: 'PPM',
      value: fmtPerMile(ppm),
      helper: 'per mile',
      tone: ppm === null ? 'neutral' : ppm >= 0 ? 'positive' : 'negative',
      delta: ppmDelta,
    },
    {
      label: 'Utilization',
      value: fmtPct(utilizationPct),
      helper: `${fmtNumber(activeDays)} active days`,
      delta: utilDelta,
    },
  ]

  return (
    <div className="space-y-3">
      {/* Primary row — the four headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {primary.map((m) => (
          <div
            key={m.label}
            className="widget-card !p-5"
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {m.label}
            </p>
            <p
              className={cn(
                'mt-2 text-2xl font-semibold tabular-nums tracking-tight',
                toneClass(m.tone ?? 'neutral'),
              )}
            >
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Secondary strip — efficiency metrics with vs-fleet-avg deltas */}
      <div className="widget-card !p-5">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {secondary.map((m) => (
            <div key={m.label} className="flex flex-col">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {m.label}
                {m.helper && (
                  <span className="ml-1.5 text-[10px] normal-case tracking-normal text-muted-foreground/70">
                    {m.helper}
                  </span>
                )}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-xl font-semibold tabular-nums tracking-tight',
                  toneClass(m.tone ?? 'neutral'),
                )}
              >
                {m.value}
              </p>
              {m.delta && (
                <p
                  className={cn(
                    'mt-0.5 text-[11px] font-medium tabular-nums',
                    m.delta.direction === 'up' && 'text-emerald-600',
                    m.delta.direction === 'down' && 'text-rose-600',
                    m.delta.direction === 'flat' && 'text-muted-foreground',
                  )}
                >
                  {m.delta.direction === 'up' && '↑ '}
                  {m.delta.direction === 'down' && '↓ '}
                  {m.delta.direction === 'flat' && '− '}
                  {m.delta.label}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
