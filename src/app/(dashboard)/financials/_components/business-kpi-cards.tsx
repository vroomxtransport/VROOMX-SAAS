'use client'

import { cn } from '@/lib/utils'
import type { PnLOutput, UnitMetrics } from '@/lib/financial/pnl-calculations'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Route,
  Truck,
  Target,
  Shield,
  Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface BusinessKPICardsProps {
  pnl: PnLOutput
  unitMetrics: UnitMetrics
}

interface KPICardDef {
  label: string
  value: string
  icon: LucideIcon
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
  description?: string
  tooltip?: string
}

const ICON_STYLES = {
  blue: 'text-blue-600 bg-blue-100',
  emerald: 'text-emerald-600 bg-emerald-100',
  amber: 'text-amber-600 bg-amber-100',
  violet: 'text-violet-600 bg-violet-100',
  rose: 'text-rose-600 bg-rose-100',
}

function fmt$(val: number): string {
  if (Math.abs(val) >= 1000) {
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(val: number): string {
  return `${val.toFixed(1)}%`
}

function fmtPerMile(val: number | null): string {
  if (val === null) return 'N/A'
  return `$${val.toFixed(2)}/mi`
}

export function BusinessKPICards({ pnl, unitMetrics }: BusinessKPICardsProps) {
  const topCards: KPICardDef[] = [
    { label: 'Revenue', value: fmt$(pnl.revenue), icon: DollarSign, accent: 'blue' },
    {
      label: 'Net Profit',
      value: fmt$(pnl.netProfitBeforeTax),
      icon: pnl.netProfitBeforeTax >= 0 ? TrendingUp : TrendingDown,
      accent: pnl.netProfitBeforeTax >= 0 ? 'emerald' : 'rose',
      description: 'After all costs + overhead',
    },
    {
      label: 'Net Margin',
      value: fmtPct(pnl.netMargin),
      icon: Target,
      accent: pnl.netMargin >= 10 ? 'emerald' : pnl.netMargin >= 0 ? 'amber' : 'rose',
      description: 'Net profit / revenue',
    },
  ]

  const fixedCostCard: KPICardDef = {
    label: 'Fixed Costs',
    value: fmt$(pnl.fixedCosts),
    icon: Shield,
    accent: 'violet',
    description: 'Insurance, rent, leases, etc.',
  }

  const row2: KPICardDef[] = [
    {
      label: 'Business RPM',
      value: fmtPerMile(unitMetrics.rpm),
      icon: Route,
      accent: 'blue',
      description: 'Revenue Per Mile',
      tooltip: 'Total revenue divided by total miles driven',
    },
    {
      label: 'Business CPM',
      value: fmtPerMile(unitMetrics.netProfitPerMile !== null && unitMetrics.rpm !== null
        ? (unitMetrics.rpm - unitMetrics.netProfitPerMile)
        : null),
      icon: TrendingDown,
      accent: 'amber',
      description: 'Cost Per Mile (all overhead)',
      tooltip: 'Includes trip costs + prorated business expenses (insurance, rent, truck leases, software, etc.)',
    },
    {
      label: 'Business PPM',
      value: fmtPerMile(unitMetrics.netProfitPerMile),
      icon: TrendingUp,
      accent: unitMetrics.netProfitPerMile !== null && unitMetrics.netProfitPerMile >= 0 ? 'emerald' : 'rose',
      description: 'Profit Per Mile (true)',
      tooltip: 'Net profit after ALL costs (trip + business overhead) divided by total miles',
    },
    {
      label: 'Break-Even Revenue',
      value: pnl.breakEvenRevenue !== null ? fmt$(pnl.breakEvenRevenue) : 'N/A',
      icon: Target,
      accent: 'violet',
      description: 'Revenue needed to cover overhead',
      tooltip: 'Revenue needed to cover fixed business expenses at your current gross margin ratio',
    },
  ]

  const row3: KPICardDef[] = [
    {
      label: 'Profit / Truck',
      value: unitMetrics.netProfitPerTruck !== null ? fmt$(unitMetrics.netProfitPerTruck) : 'N/A',
      icon: Truck,
      accent: unitMetrics.netProfitPerTruck !== null && unitMetrics.netProfitPerTruck >= 0 ? 'emerald' : 'rose',
      description: 'Net profit per active truck',
    },
    {
      label: 'Fixed Cost / Truck',
      value: unitMetrics.fixedCostPerTruck !== null ? fmt$(unitMetrics.fixedCostPerTruck) : 'N/A',
      icon: Shield,
      accent: 'amber',
      description: 'Overhead per active truck',
    },
    {
      label: 'Revenue / Truck',
      value: unitMetrics.revenuePerTruck !== null ? fmt$(unitMetrics.revenuePerTruck) : 'N/A',
      icon: DollarSign,
      accent: 'blue',
      description: 'Revenue per active truck',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Business Overview</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                True business profitability including prorated overhead costs (insurance, rent, truck leases, software, etc.) — not just trip-level expenses.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Top 3 premium cards + Fixed Costs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {topCards.map((card) => (
          <PrimaryKPICard
            key={card.label}
            {...card}
            shimmer={card.label === 'Net Profit'}
          />
        ))}
        <StandardKPICard {...fixedCostCard} />
      </div>

      {/* Business Metrics section */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-3">Business Metrics</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row2.map((card) => (
          <StandardKPICard key={card.label} {...card} />
        ))}
      </div>

      {/* Per-Truck Analysis section */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-3">Per-Truck Analysis</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {row3.map((card) => (
          <StandardKPICard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function PrimaryKPICard({ label, value, icon: Icon, accent, description, tooltip, shimmer }: KPICardDef & { shimmer?: boolean }) {
  const card = (
    <div className={cn('widget-card-primary p-4', shimmer && 'shimmer-border')}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            {tooltip && (
              <Info className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
          </div>
          <p className="mt-1 text-3xl font-bold tabular-nums text-foreground truncate">{value}</p>
          {description && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">{description}</p>
          )}
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {card}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
}

function StandardKPICard({ label, value, icon: Icon, accent, description, tooltip }: KPICardDef) {
  const card = (
    <div className="widget-card p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            {tooltip && (
              <Info className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground truncate">{value}</p>
          {description && (
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">{description}</p>
          )}
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {card}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return card
}
