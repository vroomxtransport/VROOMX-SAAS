'use client'

import { useState } from 'react'
import { usePnLData, useMonthlyPnLTrend } from '@/hooks/use-pnl'
import { PnLStatement } from './pnl-statement'
import { UnitMetricsTable } from './unit-metrics-table'
import { MonthlyPnLTable } from './monthly-pnl-table'
import { RevenueWaterfallChart } from './revenue-waterfall-chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { FinancialPeriod } from '@/lib/queries/financials'

const PERIODS: { value: FinancialPeriod; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
  { value: 'last30', label: '30d' },
  { value: 'last90', label: '90d' },
]

export function PnLReportDashboard() {
  const [period, setPeriod] = useState<FinancialPeriod>('ytd')
  const { pnl, metrics, isLoading } = usePnLData(period)
  const { monthlyData, isLoading: trendLoading } = useMonthlyPnLTrend(12)

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              period === p.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
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
      ) : null}
    </div>
  )
}
