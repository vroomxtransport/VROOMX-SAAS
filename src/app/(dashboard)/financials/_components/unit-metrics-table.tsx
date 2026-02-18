'use client'

import type { UnitMetrics } from '@/lib/financial/pnl-calculations'
import { Truck, Route, Gauge } from 'lucide-react'

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

export function UnitMetricsTable({ metrics }: Props) {
  return (
    <div className="space-y-4">
      {/* Volume Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <VolumeStat label="Trucks in Service" value={fmtNumber(metrics.trucksInService)} />
        <VolumeStat label="Completed Trips" value={fmtNumber(metrics.tripCount)} />
        <VolumeStat label="Cars Hauled" value={fmtNumber(metrics.carsHauled)} />
        <VolumeStat label="Total Miles" value={fmtNumber(Math.round(metrics.totalMiles))} />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Per-Truck */}
        <MetricsColumn
          title="Per-Truck Metrics"
          icon={<Truck className="h-4 w-4" />}
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

function VolumeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function MetricsColumn({ title, icon, items }: {
  title: string
  icon: React.ReactNode
  items: { label: string; value: string }[]
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-sm font-medium tabular-nums text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
