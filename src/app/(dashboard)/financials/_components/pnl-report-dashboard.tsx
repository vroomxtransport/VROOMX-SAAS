'use client'

import { useState } from 'react'
import type { DateRange } from '@/types/filters'
import { usePnLData, useMonthlyPnLTrend, type PnLBasis } from '@/hooks/use-pnl'
import { PnLStatement } from './pnl-statement'
import { UnitMetricsTable } from './unit-metrics-table'
import { MonthlyPnLTable } from './monthly-pnl-table'
import { RevenueWaterfallChart } from './revenue-waterfall-chart'
import { PeriodSelector } from './period-selector'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

export function PnLReportDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [basis, setBasis] = useState<PnLBasis>('accrual')
  const { pnl, metrics, isLoading } = usePnLData(dateRange, basis)
  // The monthly trend is intentionally always accrual — it's a historical
  // comparison view where GAAP-consistent comparison matters more than
  // reflecting the current cash position.
  const { monthlyData, isLoading: trendLoading } = useMonthlyPnLTrend(12)

  return (
    <div className="space-y-6">
      {/* Basis toggle + Period Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BasisToggle value={basis} onChange={setBasis} />
        <PeriodSelector value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      ) : pnl && metrics ? (
        <>
          {/* Revenue Waterfall + P&L Statement side by side */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PnLStatement pnl={pnl} />
            <RevenueWaterfallChart pnl={pnl} />
          </div>

          {/* Unit Metrics */}
          <UnitMetricsTable metrics={metrics} />

          {/* Monthly P&L Trend Table */}
          {!trendLoading && monthlyData && (
            <MonthlyPnLTable data={monthlyData} />
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No financial data for this period. Create orders and trips to generate your P&L report.</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wave 6: Accrual / Cash basis toggle
// ---------------------------------------------------------------------------

interface BasisToggleProps {
  value: PnLBasis
  onChange: (basis: PnLBasis) => void
}

function BasisToggle({ value, onChange }: BasisToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Basis
              <Info className="h-3 w-3" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[280px] text-xs">
            <p className="mb-1 font-semibold">Accrual</p>
            <p className="mb-2 text-muted-foreground">
              Revenue is recognized when the order is delivered (GAAP
              default). Matches what your books say you earned.
            </p>
            <p className="mb-1 font-semibold">Cash</p>
            <p className="text-muted-foreground">
              Revenue is recognized when the customer actually paid.
              Broker and local fees flow through proportionally. Shows
              your real cash position, not what&apos;s booked.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div
        role="group"
        aria-label="Accounting basis"
        className="inline-flex items-center rounded-md border border-border bg-card p-0.5 text-xs"
      >
        {(['accrual', 'cash'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded px-3 py-1 font-medium capitalize transition-colors',
              value === option
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
