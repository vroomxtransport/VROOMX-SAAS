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
import { KPIDelta } from '@/components/shared/kpi-delta'

interface KPICardsProps {
  kpis: KPIOutput
  revenue: number
  /** KPIs computed from the prior period — undefined while loading, null when unavailable */
  prevKpis?: KPIOutput | null
  prevRevenue?: number | null
  prevOrderCount?: number | null
}

interface KPICardDef {
  label: string
  value: string
  icon: LucideIcon
  accent: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
  description?: string
  borderColor: string
  delta?: { current: number; previous: number; invertColor?: boolean }
}

const ICON_STYLES = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  violet: 'text-violet-600',
  rose: 'text-rose-600',
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

export function KPICards({ kpis, revenue, prevKpis, prevRevenue, prevOrderCount }: KPICardsProps) {
  const row1: KPICardDef[] = [
    {
      label: 'Revenue',
      value: fmt$(revenue),
      icon: DollarSign,
      accent: 'blue',
      borderColor: 'border-l-blue-500',
      delta: prevRevenue != null ? { current: revenue, previous: prevRevenue } : undefined,
    },
    {
      label: 'Net Profit',
      value: fmt$(kpis.netProfit),
      icon: kpis.netProfit >= 0 ? TrendingUp : TrendingDown,
      accent: kpis.netProfit >= 0 ? 'emerald' : 'rose',
      borderColor: kpis.netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500',
      delta: prevKpis != null ? { current: kpis.netProfit, previous: prevKpis.netProfit } : undefined,
    },
    {
      label: 'Operating Ratio',
      value: fmtPct(kpis.operatingRatio),
      icon: Gauge,
      accent: kpis.operatingRatio <= 95 ? 'emerald' : kpis.operatingRatio <= 100 ? 'amber' : 'rose',
      borderColor: kpis.operatingRatio <= 95 ? 'border-l-emerald-500' : 'border-l-amber-500',
      delta: prevKpis != null ? { current: kpis.operatingRatio, previous: prevKpis.operatingRatio, invertColor: true } : undefined,
    },
    {
      label: 'Gross Margin',
      value: fmtPct(kpis.grossMargin),
      icon: TrendingUp,
      accent: kpis.grossMargin >= 30 ? 'emerald' : kpis.grossMargin >= 15 ? 'amber' : 'rose',
      borderColor: kpis.grossMargin >= 30 ? 'border-l-emerald-500' : 'border-l-amber-500',
      delta: prevKpis != null ? { current: kpis.grossMargin, previous: prevKpis.grossMargin } : undefined,
    },
  ]

  const row2: KPICardDef[] = [
    { label: 'Clean Gross', value: fmt$(kpis.cleanGross), icon: BarChart3, accent: 'blue', description: 'Revenue - Fees', borderColor: 'border-l-blue-500' },
    { label: 'Truck Gross', value: fmt$(kpis.truckGross), icon: Truck, accent: 'violet', description: 'Clean Gross - Driver Pay', borderColor: 'border-l-violet-500' },
    { label: 'Truck Gross Margin', value: fmtPct(kpis.truckGrossMargin), icon: Gauge, accent: kpis.truckGrossMargin >= 30 ? 'emerald' : kpis.truckGrossMargin >= 15 ? 'amber' : 'rose', borderColor: kpis.truckGrossMargin >= 30 ? 'border-l-emerald-500' : 'border-l-amber-500' },
  ]

  const row3: KPICardDef[] = [
    {
      label: 'RPM',
      value: fmtPerMile(kpis.rpm),
      icon: Route,
      accent: 'blue',
      description: 'Revenue Per Mile',
      borderColor: 'border-l-blue-500',
      delta: prevKpis != null && kpis.rpm != null && prevKpis.rpm != null
        ? { current: kpis.rpm, previous: prevKpis.rpm }
        : undefined,
    },
    {
      label: 'CPM',
      value: fmtPerMile(kpis.cpm),
      icon: TrendingDown,
      accent: 'amber',
      description: 'Cost Per Mile',
      borderColor: 'border-l-amber-500',
      delta: prevKpis != null && kpis.cpm != null && prevKpis.cpm != null
        ? { current: kpis.cpm, previous: prevKpis.cpm, invertColor: true }
        : undefined,
    },
    {
      label: 'PPM',
      value: fmtPerMile(kpis.ppm),
      icon: TrendingUp,
      accent: kpis.ppm !== null && kpis.ppm >= 0 ? 'emerald' : 'rose',
      description: 'Profit Per Mile',
      borderColor: kpis.ppm !== null && kpis.ppm >= 0 ? 'border-l-emerald-500' : 'border-l-rose-500',
      delta: prevKpis != null && kpis.ppm != null && prevKpis.ppm != null
        ? { current: kpis.ppm, previous: prevKpis.ppm }
        : undefined,
    },
    {
      label: 'APPO',
      value: fmt$(kpis.appo),
      icon: Package,
      accent: 'violet',
      description: 'Avg Pay Per Order',
      borderColor: 'border-l-violet-500',
      delta: prevOrderCount != null && prevRevenue != null
        ? { current: kpis.appo, previous: prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0 }
        : undefined,
    },
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

      {/* Revenue & Profit */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Revenue &amp; Profit</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row1.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>

      {/* Clean Gross Analysis */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-2">Clean Gross Analysis</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {row2.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>

      {/* Per-Mile & Per-Order */}
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-2">Per-Mile &amp; Per-Order</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {row3.map((card) => (
          <KPICard key={card.label} {...card} />
        ))}
      </div>
    </div>
  )
}

function KPICard({ label, value, icon: Icon, accent, description, borderColor, delta }: KPICardDef) {
  return (
    <div className={cn('widget-card border-l-4 p-4', borderColor)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground truncate">{value}</p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {delta && (
              <KPIDelta
                current={delta.current}
                previous={delta.previous}
                invertColor={delta.invertColor}
              />
            )}
            {description && (
              <p className="text-[10px] text-muted-foreground/70">{description}</p>
            )}
          </div>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ICON_STYLES[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}
