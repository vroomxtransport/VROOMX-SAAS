'use client'

import type { UnitMetrics } from '@/lib/financial/pnl-calculations'
import { Truck, Route, Gauge, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function fmtRate(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

interface Props {
  metrics: UnitMetrics
}

type AccentColor = 'blue' | 'emerald' | 'amber' | 'violet'

const accentStyles: Record<AccentColor, { iconBg: string; iconText: string; dot: string }> = {
  blue: { iconBg: 'bg-blue-100 dark:bg-blue-950/40', iconText: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  emerald: { iconBg: 'bg-emerald-100 dark:bg-emerald-950/40', iconText: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  amber: { iconBg: 'bg-amber-100 dark:bg-amber-950/40', iconText: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  violet: { iconBg: 'bg-violet-100 dark:bg-violet-950/40', iconText: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
}

export function UnitMetricsTable({ metrics }: Props) {
  return (
    <div className="space-y-4">
      {/* Volume Stats */}
      <div className="widget-card p-5">
        <div className="widget-header !px-0 !border-b-0 !pb-4">
          <div className="widget-title">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', accentStyles.violet.iconBg)}>
              <BarChart3 className={cn('h-4 w-4', accentStyles.violet.iconText)} />
            </div>
            Volume Statistics
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <VolumeStat label="Trucks in Service" value={fmtNumber(metrics.trucksInService)} accent="violet" />
          <VolumeStat label="Completed Trips" value={fmtNumber(metrics.tripCount)} accent="violet" />
          <VolumeStat label="Cars Hauled" value={fmtNumber(metrics.carsHauled)} accent="violet" />
          <VolumeStat label="Total Miles" value={fmtNumber(Math.round(metrics.totalMiles))} accent="violet" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Per-Truck */}
        <MetricsColumn
          title="Per-Truck Metrics"
          icon={<Truck className="h-4 w-4" />}
          accent="blue"
          items={[
            { label: 'Revenue / Truck', value: fmtCurrency(metrics.revenuePerTruck) },
            { label: 'Truck Gross / Truck', value: fmtCurrency(metrics.truckGrossPerTruck) },
            { label: 'Fixed Cost / Truck', value: fmtCurrency(metrics.fixedCostPerTruck) },
            { label: 'Net Profit / Truck', value: fmtCurrency(metrics.netProfitPerTruck) },
          ]}
        />

        {/* Per-Trip */}
        <MetricsColumn
          title="Per-Trip Metrics"
          icon={<Route className="h-4 w-4" />}
          accent="emerald"
          items={[
            { label: 'Revenue / Trip', value: fmtCurrency(metrics.revenuePerTrip) },
            { label: 'Truck Gross / Trip', value: fmtCurrency(metrics.truckGrossPerTrip) },
            { label: 'APPC', value: fmtCurrency(metrics.appc) },
            { label: 'Overhead / Trip', value: fmtCurrency(metrics.overheadPerTrip) },
            { label: 'Direct Cost / Trip', value: fmtCurrency(metrics.directCostPerTrip) },
            { label: 'Net Profit / Trip', value: fmtCurrency(metrics.netProfitPerTrip) },
          ]}
        />

        {/* Per-Mile */}
        <MetricsColumn
          title="Per-Mile Metrics"
          icon={<Gauge className="h-4 w-4" />}
          accent="amber"
          items={[
            { label: 'RPM', value: fmtRate(metrics.rpm) },
            { label: 'Truck Gross / Mile', value: fmtRate(metrics.truckGrossPerMile) },
            { label: 'Fixed Cost / Mile', value: fmtRate(metrics.fixedCostPerMile) },
            { label: 'Fuel Cost / Mile', value: fmtRate(metrics.fuelCostPerMile) },
            { label: 'Net Profit / Mile', value: fmtRate(metrics.netProfitPerMile) },
          ]}
        />
      </div>
    </div>
  )
}

function VolumeStat({ label, value, accent }: { label: string; value: string; accent: AccentColor }) {
  const style = accentStyles[accent]
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function MetricsColumn({ title, icon, items, accent }: {
  title: string
  icon: React.ReactNode
  items: { label: string; value: string }[]
  accent: AccentColor
}) {
  const style = accentStyles[accent]
  return (
    <div className="widget-card overflow-hidden">
      <div className="widget-header">
        <div className="widget-title">
          <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', style.iconBg)}>
            <span className={style.iconText}>{icon}</span>
          </div>
          {title}
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={cn(
              'flex items-center justify-between px-4 py-2.5',
              idx % 2 === 1 && 'bg-muted/10',
            )}
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
              {item.label}
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
