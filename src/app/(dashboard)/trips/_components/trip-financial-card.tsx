'use client'

import { cn } from '@/lib/utils'
import {
  DollarSign,
  Calculator,
  Truck,
  Receipt,
  MapPin,
  User,
  Wallet,
} from 'lucide-react'
import { DRIVER_PAY_TYPE_LABELS } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import type { DriverPayType } from '@/types'
import type { LucideIcon } from 'lucide-react'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

// --- Accent style maps ---

type Accent = 'emerald' | 'muted' | 'violet' | 'rose'

const ACCENT_STYLES: Record<Accent, string> = {
  emerald: 'border-emerald-200/50 bg-emerald-500/5',
  muted: 'border-border bg-muted/40',
  violet: 'border-violet-200/50 bg-violet-500/5',
  rose: 'border-rose-200/50 bg-rose-500/5',
}

const ICON_STYLES: Record<Accent, string> = {
  emerald: 'text-emerald-600',
  muted: 'text-muted-foreground bg-muted',
  violet: 'text-violet-600',
  rose: 'text-rose-600',
}

// --- Sub-components ---

function HeroCard({ label, value, subtitle, icon: Icon, accent }: {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accent: Accent
}) {
  return (
    <div className={cn('rounded-xl border p-3', ACCENT_STYLES[accent])}>
      <div className="flex items-center gap-2">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold tabular-nums text-foreground">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

function MetricPill({ label, value, description }: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground/70">{description}</p>
    </div>
  )
}

// --- Main component ---

interface TripFinancialCardProps {
  trip: TripWithRelations
}

export function TripFinancialCard({ trip }: TripFinancialCardProps) {
  const revenue = parseFloat(trip.total_revenue || '0')
  const carrierPay = parseFloat(trip.carrier_pay || '0')
  const brokerFees = parseFloat(trip.total_broker_fees || '0')
  const localFees = parseFloat(trip.total_local_fees || '0')
  const driverPay = parseFloat(trip.driver_pay || '0')
  const expenses = parseFloat(trip.total_expenses || '0')
  const netProfit = parseFloat(trip.net_profit || '0')
  const totalMiles = parseFloat(trip.total_miles || '0')

  // Derived metrics
  const cleanGross = revenue - brokerFees - localFees
  const truckGross = cleanGross - driverPay
  const truckGrossMargin = revenue > 0 ? (truckGross / revenue) * 100 : 0
  const appc = trip.order_count > 0 ? revenue / trip.order_count : null
  const totalCosts = brokerFees + localFees + driverPay + expenses + carrierPay
  const hasMiles = totalMiles > 0
  const rpm = hasMiles ? revenue / totalMiles : null
  const cpm = hasMiles ? totalCosts / totalMiles : null
  const ppm = hasMiles ? netProfit / totalMiles : null

  const payType = trip.driver?.pay_type as DriverPayType | undefined
  const payRate = trip.driver?.pay_rate

  // Driver pay model label for the Driver Pay card subtitle and metrics row
  let driverPayModelLabel = 'N/A'
  if (payType && payRate !== undefined && payRate !== null) {
    if (payType === 'per_car') driverPayModelLabel = `$${payRate}/car`
    else if (payType === 'percentage_of_carrier_pay') driverPayModelLabel = `${payRate}% of carrier pay`
    else if (payType === 'dispatch_fee_percent') driverPayModelLabel = `${payRate}% dispatch fee`
    else if (payType === 'per_mile') driverPayModelLabel = `$${payRate}/mile`
    else driverPayModelLabel = DRIVER_PAY_TYPE_LABELS[payType]
  }

  // True minus sign (U+2212) for deduction display
  const minus = '\u2212'
  const formatDeduction = (v: number) => v > 0 ? `${minus}${formatCurrency(v)}` : formatCurrency(v)

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Section 1: 7-card financial grid (waterfall reading order) */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <HeroCard
          label="Revenue"
          value={formatCurrency(revenue)}
          subtitle={`${trip.order_count} order${trip.order_count !== 1 ? 's' : ''}`}
          icon={DollarSign}
          accent="emerald"
        />
        <HeroCard
          label="Broker Fees"
          value={formatDeduction(brokerFees)}
          icon={Receipt}
          accent="rose"
        />
        <HeroCard
          label="Local Fees"
          value={formatDeduction(localFees)}
          icon={MapPin}
          accent="rose"
        />
        <HeroCard
          label="Driver Pay"
          value={formatDeduction(driverPay)}
          subtitle={payType ? driverPayModelLabel : undefined}
          icon={User}
          accent="rose"
        />
        <HeroCard
          label="Expenses"
          value={formatDeduction(expenses)}
          icon={Wallet}
          accent="rose"
        />
        <HeroCard
          label="Truck Gross"
          value={formatCurrency(truckGross)}
          subtitle={`${truckGrossMargin.toFixed(1)}% margin`}
          icon={Truck}
          accent="violet"
        />
        <HeroCard
          label="Net Profit"
          value={formatCurrency(netProfit)}
          icon={Calculator}
          accent={netProfit >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* Section 2: Per-Unit Metrics */}
      <div className="border-t grid grid-cols-3 gap-2 p-4 lg:grid-cols-6">
        <MetricPill
          label="RPM"
          value={rpm !== null ? `$${rpm.toFixed(2)}/mi` : 'N/A'}
          description="Revenue per mile"
        />
        <MetricPill
          label="CPM"
          value={cpm !== null ? `$${cpm.toFixed(2)}/mi` : 'N/A'}
          description="Cost per mile"
        />
        <MetricPill
          label="PPM"
          value={ppm !== null ? `$${ppm.toFixed(2)}/mi` : 'N/A'}
          description="Profit per mile"
        />
        <MetricPill
          label="APPC"
          value={appc !== null ? formatCurrency(appc) : 'N/A'}
          description="Avg pay per car"
        />
        <MetricPill
          label="Truck Gross Margin"
          value={`${truckGrossMargin.toFixed(1)}%`}
          description="Gross after driver pay"
        />
        <MetricPill
          label="Driver Pay Model"
          value={driverPayModelLabel}
          description={payType ? DRIVER_PAY_TYPE_LABELS[payType] : 'No driver assigned'}
        />
      </div>
    </div>
  )
}
