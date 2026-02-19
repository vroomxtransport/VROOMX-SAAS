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

const ACCENT_STYLES = {
  blue: 'border-blue-200/50 bg-blue-500/5 dark:border-blue-800/50 dark:bg-blue-500/10',
  emerald: 'border-emerald-200/50 bg-emerald-500/5 dark:border-emerald-800/50 dark:bg-emerald-500/10',
  amber: 'border-amber-200/50 bg-amber-500/5 dark:border-amber-800/50 dark:bg-amber-500/10',
  violet: 'border-violet-200/50 bg-violet-500/5 dark:border-violet-800/50 dark:bg-violet-500/10',
  rose: 'border-rose-200/50 bg-rose-500/5 dark:border-rose-800/50 dark:bg-rose-500/10',
}

const ICON_STYLES = {
  blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400',
  emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-400',
  amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-400',
  violet: 'text-violet-600 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-400',
  rose: 'text-rose-600 bg-rose-100 dark:bg-rose-900/50 dark:text-rose-400',
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
  const row1: KPICardDef[] = [
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
    {
      label: 'Fixed Costs',
      value: fmt$(pnl.fixedCosts),
      icon: Shield,
      accent: 'violet',
      description: 'Insurance, rent, leases, etc.',
    },
  ]

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row1.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row2.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {row3.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, accent, description, tooltip }: KPICardDef) {
  const card = (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', ACCENT_STYLES[accent])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            {tooltip && (
              <Info className="h-3 w-3 shrink-0 text-muted-foreground/40" />
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
