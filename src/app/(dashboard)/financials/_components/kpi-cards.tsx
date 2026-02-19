'use client'

import { cn } from '@/lib/utils'
import type { KPIOutput } from '@/lib/financial/kpi-calculations'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Gauge,
  Route,
  Package,
  BarChart3,
  Truck,
  Info,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

interface KPICardsProps {
  kpis: KPIOutput
  revenue: number
}

interface KPICardDef {
  label: string
  value: string
  icon: LucideIcon
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
  description?: string
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

export function KPICards({ kpis, revenue }: KPICardsProps) {
  const row1: KPICardDef[] = [
    { label: 'Revenue', value: fmt$(revenue), icon: DollarSign, accent: 'blue' },
    { label: 'Net Profit', value: fmt$(kpis.netProfit), icon: kpis.netProfit >= 0 ? TrendingUp : TrendingDown, accent: kpis.netProfit >= 0 ? 'emerald' : 'rose' },
    { label: 'Operating Ratio', value: fmtPct(kpis.operatingRatio), icon: Gauge, accent: kpis.operatingRatio <= 95 ? 'emerald' : kpis.operatingRatio <= 100 ? 'amber' : 'rose' },
    { label: 'Gross Margin', value: fmtPct(kpis.grossMargin), icon: TrendingUp, accent: kpis.grossMargin >= 30 ? 'emerald' : kpis.grossMargin >= 15 ? 'amber' : 'rose' },
  ]

  const row2: KPICardDef[] = [
    { label: 'Clean Gross', value: fmt$(kpis.cleanGross), icon: BarChart3, accent: 'blue', description: 'Revenue - Fees' },
    { label: 'Truck Gross', value: fmt$(kpis.truckGross), icon: Truck, accent: 'violet', description: 'Clean Gross - Driver Pay' },
    { label: 'Truck Gross Margin', value: fmtPct(kpis.truckGrossMargin), icon: Gauge, accent: kpis.truckGrossMargin >= 30 ? 'emerald' : kpis.truckGrossMargin >= 15 ? 'amber' : 'rose' },
  ]

  const row3: KPICardDef[] = [
    { label: 'RPM', value: fmtPerMile(kpis.rpm), icon: Route, accent: 'blue', description: 'Revenue Per Mile' },
    { label: 'CPM', value: fmtPerMile(kpis.cpm), icon: TrendingDown, accent: 'amber', description: 'Cost Per Mile' },
    { label: 'PPM', value: fmtPerMile(kpis.ppm), icon: TrendingUp, accent: kpis.ppm !== null && kpis.ppm >= 0 ? 'emerald' : 'rose', description: 'Profit Per Mile' },
    { label: 'APPO', value: fmt$(kpis.appo), icon: Package, accent: 'violet', description: 'Avg Pay Per Order' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Trip Performance</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">
                Based on trip revenue and direct trip expenses only — excludes business overhead (insurance, rent, leases, etc.).
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {row2.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row3.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, accent, description }: KPICardDef) {
  return (
    <div className={cn('rounded-xl border p-4 transition-shadow hover:shadow-sm', ACCENT_STYLES[accent])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
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
}
