'use client'

import { useState } from 'react'
import type { DateRange } from '@/types/filters'
import { usePnLData, useMonthlyPnLTrend } from '@/hooks/use-pnl'
import { PnLStatement } from './pnl-statement'
import { UnitMetricsTable } from './unit-metrics-table'
import { MonthlyPnLTable } from './monthly-pnl-table'
import { RevenueWaterfallChart } from './revenue-waterfall-chart'
import { PeriodSelector } from './period-selector'
import { Skeleton } from '@/components/ui/skeleton'

export function PnLReportDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const { pnl, metrics, isLoading } = usePnLData(dateRange)
  const { monthlyData, isLoading: trendLoading } = useMonthlyPnLTrend(12)

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end">
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
