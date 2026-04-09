'use client'

import { usePnLData } from '@/hooks/use-pnl'
import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface WaterfallLevel {
  label: string
  value: number
  color: string
  barColor: string
}

function WaterfallBar({ level, maxValue }: { level: WaterfallLevel; maxValue: number }) {
  const pct = maxValue > 0 ? Math.max((level.value / maxValue) * 100, 0) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{level.label}</span>
        <span className={cn('text-sm font-semibold tabular-nums', level.color)}>
          {fmt(level.value)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-border-subtle overflow-hidden">
        <div
          className={cn('h-2 rounded-full transition-all duration-700', level.barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-emerald-500" />
          P&L Summary
        </span>
      </div>
      <div className="flex-1 space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
            <div className="h-2 rounded-full bg-muted" />
          </div>
        ))}
        <div className="mt-4 h-12 rounded-xl bg-muted" />
      </div>
    </div>
  )
}

export function PnlSummary() {
  const { pnl, isLoading } = usePnLData()

  if (isLoading) return <LoadingSkeleton />

  if (!pnl) {
    return (
      <div className="widget-card h-full flex flex-col">
        <div className="widget-header">
          <span className="widget-title">
            <span className="widget-accent-dot bg-emerald-500" />
            P&L Summary
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No financial data available</p>
        </div>
      </div>
    )
  }

  const revenue = pnl.revenue
  const cleanGross = pnl.cleanGross
  const truckGross = pnl.truckGross
  const netProfit = pnl.netProfitBeforeTax
  const netMargin = pnl.netMargin
  const isPositive = netProfit >= 0

  const levels: WaterfallLevel[] = [
    {
      label: 'Revenue',
      value: revenue,
      color: 'text-slate-700',
      barColor: 'bg-gradient-to-r from-slate-500 to-slate-400',
    },
    {
      label: 'Clean Gross',
      value: cleanGross,
      color: 'text-blue-600',
      barColor: 'bg-gradient-to-r from-blue-500 to-blue-400',
    },
    {
      label: 'Truck Gross',
      value: truckGross,
      color: 'text-brand',
      barColor: 'bg-gradient-to-r from-brand to-[#e5631f]',
    },
    {
      label: 'Net Profit',
      value: netProfit,
      color: isPositive ? 'text-emerald-600' : 'text-red-600',
      barColor: isPositive
        ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
        : 'bg-gradient-to-r from-red-500 to-red-400',
    },
  ]

  const TrendIcon = netMargin > 1 ? TrendingUp : netMargin < -1 ? TrendingDown : Minus

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-emerald-500" />
          P&L Summary
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          MTD
        </span>
      </div>

      {/* Waterfall visualization */}
      <div className="flex-1 min-h-0 space-y-3">
        {levels.map((level) => (
          <WaterfallBar key={level.label} level={level} maxValue={revenue} />
        ))}
      </div>

      {/* Net Margin highlight */}
      <div className="mt-4 rounded-xl border border-border-subtle bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Net Margin</span>
          <div className="flex items-center gap-1.5">
            <TrendIcon
              className={cn(
                'h-4 w-4',
                isPositive ? 'text-emerald-500' : 'text-red-500'
              )}
            />
            <span
              className={cn(
                'text-xl font-bold tabular-nums',
                isPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {netMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/financials"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-brand"
      >
        View Financials
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
