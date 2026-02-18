'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { updateTrip } from '@/app/actions/trips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DollarSign,
  Building2,
  Calculator,
  Pencil,
  Check,
  X,
  Loader2,
  Truck,
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

// --- Accent style maps (reused from kpi-cards pattern) ---

type Accent = 'emerald' | 'muted' | 'violet' | 'rose'

const ACCENT_STYLES: Record<Accent, string> = {
  emerald: 'border-emerald-200/50 bg-emerald-500/5 dark:border-emerald-800/50 dark:bg-emerald-500/10',
  muted: 'border-border bg-muted/40 dark:bg-muted/20',
  violet: 'border-violet-200/50 bg-violet-500/5 dark:border-violet-800/50 dark:bg-violet-500/10',
  rose: 'border-rose-200/50 bg-rose-500/5 dark:border-rose-800/50 dark:bg-rose-500/10',
}

const ICON_STYLES: Record<Accent, string> = {
  emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400',
  muted: 'text-muted-foreground bg-muted dark:bg-muted/60',
  violet: 'text-violet-600 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-400',
  rose: 'text-rose-600 bg-rose-100 dark:bg-rose-900/50 dark:text-rose-400',
}

// --- Sub-components ---

function HeroCard({ label, value, subtitle, icon: Icon, accent, editAction }: {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  accent: Accent
  editAction?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border p-4', ACCENT_STYLES[accent])}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
        </div>
        {editAction}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}

function WaterfallLine({ label, value, valueStr, bold, indent, highlight, bottomLine }: {
  label: string
  value?: number
  valueStr?: string
  bold?: boolean
  indent?: boolean
  highlight?: boolean
  bottomLine?: 'positive' | 'negative'
}) {
  const displayValue = valueStr ?? (value !== undefined ? formatCurrency(value) : '')

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2',
      highlight && 'bg-muted/30 dark:bg-muted/10',
      bottomLine === 'positive' && 'bg-green-50/50 dark:bg-green-950/20',
      bottomLine === 'negative' && 'bg-red-50/50 dark:bg-red-950/20',
    )}>
      <span className={cn(
        indent && 'pl-4',
        bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
        bottomLine && 'font-bold text-foreground',
      )}>
        {label}
      </span>
      <span className={cn(
        'tabular-nums',
        bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
        bottomLine === 'positive' && 'font-bold text-green-700 dark:text-green-400',
        bottomLine === 'negative' && 'font-bold text-red-700 dark:text-red-400',
        !bottomLine && value !== undefined && value < 0 && 'text-red-600 dark:text-red-400',
      )}>
        {displayValue}
      </span>
    </div>
  )
}

function MetricPill({ label, value, description }: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-lg bg-muted/40 dark:bg-muted/20 px-3 py-2.5">
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
  const queryClient = useQueryClient()
  const [isEditingCarrierPay, setIsEditingCarrierPay] = useState(false)
  const [carrierPayValue, setCarrierPayValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const revenue = parseFloat(trip.total_revenue || '0')
  const carrierPay = parseFloat(trip.carrier_pay || '0')
  const brokerFees = parseFloat(trip.total_broker_fees || '0')
  const localFees = parseFloat(trip.total_local_fees || '0')
  const driverPay = parseFloat(trip.driver_pay || '0')
  const expenses = parseFloat(trip.total_expenses || '0')
  const netProfit = parseFloat(trip.net_profit || '0')

  // Derived P&L metrics (computed client-side from existing denormalized fields)
  const cleanGross = revenue - brokerFees - localFees
  const truckGross = cleanGross - driverPay
  const truckGrossMargin = revenue > 0 ? (truckGross / revenue) * 100 : 0
  const appc = trip.order_count > 0 ? revenue / trip.order_count : null

  const payType = trip.driver?.pay_type as DriverPayType | undefined
  const payRate = trip.driver?.pay_rate

  const handleStartEdit = useCallback(() => {
    setCarrierPayValue(String(carrierPay))
    setIsEditingCarrierPay(true)
  }, [carrierPay])

  const handleCancelEdit = useCallback(() => {
    setIsEditingCarrierPay(false)
    setCarrierPayValue('')
  }, [])

  const handleSaveCarrierPay = useCallback(async () => {
    const numValue = parseFloat(carrierPayValue)
    if (isNaN(numValue) || numValue < 0) return

    setIsSaving(true)
    try {
      const result = await updateTrip(trip.id, { carrier_pay: numValue })
      if ('error' in result && result.error) {
        console.error('Failed to update carrier pay:', result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] })
      setIsEditingCarrierPay(false)
    } finally {
      setIsSaving(false)
    }
  }, [trip.id, carrierPayValue, queryClient])

  const carrierPayEditAction = isEditingCarrierPay ? (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.01"
        min="0"
        value={carrierPayValue}
        onChange={(e) => setCarrierPayValue(e.target.value)}
        className="h-7 w-24 text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSaveCarrierPay()
          if (e.key === 'Escape') handleCancelEdit()
        }}
        autoFocus
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleSaveCarrierPay}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5 text-green-600" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={handleCancelEdit}
        disabled={isSaving}
      >
        <X className="h-3.5 w-3.5 text-muted-foreground/60" />
      </Button>
    </div>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0"
      onClick={handleStartEdit}
    >
      <Pencil className="h-3.5 w-3.5 text-muted-foreground/60" />
    </Button>
  )

  // Driver pay model label for metrics section
  let driverPayModelLabel = 'N/A'
  if (payType && payRate !== undefined && payRate !== null) {
    if (payType === 'per_car') driverPayModelLabel = `$${payRate}/car`
    else if (payType === 'percentage_of_carrier_pay') driverPayModelLabel = `${payRate}% of carrier pay`
    else if (payType === 'dispatch_fee_percent') driverPayModelLabel = `${payRate}% dispatch fee`
    else if (payType === 'per_mile') driverPayModelLabel = `$${payRate}/mile`
    else driverPayModelLabel = DRIVER_PAY_TYPE_LABELS[payType]
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Section 1: Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        <HeroCard
          label="Revenue"
          value={formatCurrency(revenue)}
          subtitle={`${trip.order_count} order${trip.order_count !== 1 ? 's' : ''}`}
          icon={DollarSign}
          accent="emerald"
        />
        <HeroCard
          label="Carrier Pay"
          value={isEditingCarrierPay ? '' : formatCurrency(carrierPay)}
          icon={Building2}
          accent="muted"
          editAction={carrierPayEditAction}
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

      {/* Section 2: P&L Waterfall */}
      <div className="border-t">
        <div className="px-4 py-2 bg-muted/30 dark:bg-muted/10">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">P&L Breakdown</span>
        </div>
        <div className="divide-y divide-border/50 text-sm">
          <WaterfallLine label="Revenue" value={revenue} bold />
          <WaterfallLine label="− Broker Fees" value={-brokerFees} indent />
          <WaterfallLine label="− Local Fees" value={-localFees} indent />
          <WaterfallLine label="= Clean Gross" value={cleanGross} bold highlight />
          <WaterfallLine
            label="− Driver Pay"
            value={-driverPay}
            indent
          />
          <WaterfallLine label="= Truck Gross" value={truckGross} bold highlight />
          <WaterfallLine label="− Expenses" value={-expenses} indent />
          <WaterfallLine
            label="= Net Profit"
            value={netProfit}
            bottomLine={netProfit >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>

      {/* Section 3: Per-Unit Metrics */}
      <div className="border-t grid grid-cols-3 gap-2 p-4">
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
