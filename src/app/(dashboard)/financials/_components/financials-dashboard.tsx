'use client'

import { useState } from 'react'
import type { FinancialPeriod, KPIAggregates, ProfitByTruck, ProfitByDriver, MonthlyKPITrend, MonthlyRevenue, TopBroker } from '@/lib/queries/financials'
import type { PnLInput } from '@/lib/financial/pnl-calculations'
import { calculateKPIs, calculateExpenseBreakdown } from '@/lib/financial/kpi-calculations'
import { calculatePnL, calculateUnitMetrics } from '@/lib/financial/pnl-calculations'
import { PeriodSelector } from './period-selector'
import { BusinessKPICards } from './business-kpi-cards'
import { KPICards } from './kpi-cards'
import { RevenueExpensesChart } from './revenue-expenses-chart'
import { ExpenseBreakdownChart } from './expense-breakdown-chart'
import { KPITrendChart } from './kpi-trend-chart'
import { ProfitByTruckTable } from './profit-by-truck-table'
import { ProfitByDriverTable } from './profit-by-driver-table'
import { TopBrokersTable } from './top-brokers-table'
import { createClient } from '@/lib/supabase/client'
import { fetchKPIAggregates, fetchProfitByTruck, fetchProfitByDriver, fetchPnLData } from '@/lib/queries/financials'
import { useQuery } from '@tanstack/react-query'

interface FinancialsDashboardProps {
  initialAggregates: KPIAggregates
  initialPnLData: PnLInput
  initialProfitByTruck: ProfitByTruck[]
  initialProfitByDriver: ProfitByDriver[]
  kpiTrend: MonthlyKPITrend[]
  revenueByMonth: MonthlyRevenue[]
  topBrokers: TopBroker[]
}

export function FinancialsDashboard({
  initialAggregates,
  initialPnLData,
  initialProfitByTruck,
  initialProfitByDriver,
  kpiTrend,
  revenueByMonth,
  topBrokers,
}: FinancialsDashboardProps) {
  const [period, setPeriod] = useState<FinancialPeriod>('mtd')
  const supabase = createClient()

  // Fetch KPI aggregates for selected period
  const { data: aggregates } = useQuery({
    queryKey: ['financials', 'kpi', period],
    queryFn: () => fetchKPIAggregates(supabase, period),
    initialData: period === 'mtd' ? initialAggregates : undefined,
    staleTime: 60_000,
  })

  // Fetch PnL data for selected period (includes business expenses)
  const { data: pnlData } = useQuery({
    queryKey: ['financials', 'pnl', period],
    queryFn: () => fetchPnLData(supabase, period),
    initialData: period === 'mtd' ? initialPnLData : undefined,
    staleTime: 60_000,
  })

  const { data: profitByTruck } = useQuery({
    queryKey: ['financials', 'profit-by-truck', period],
    queryFn: () => fetchProfitByTruck(supabase, period),
    initialData: period === 'mtd' ? initialProfitByTruck : undefined,
    staleTime: 60_000,
  })

  const { data: profitByDriver } = useQuery({
    queryKey: ['financials', 'profit-by-driver', period],
    queryFn: () => fetchProfitByDriver(supabase, period),
    initialData: period === 'mtd' ? initialProfitByDriver : undefined,
    staleTime: 60_000,
  })

  // Compute trip-level KPIs (without business expenses)
  const agg = aggregates ?? initialAggregates
  const kpis = calculateKPIs(agg)
  const expenseBreakdown = calculateExpenseBreakdown({
    driverPay: agg.totalDriverPay,
    brokerFees: agg.totalBrokerFees,
    carrierPay: agg.totalCarrierPay,
    fuel: agg.expensesByCategory.fuel,
    tolls: agg.expensesByCategory.tolls,
    repairs: agg.expensesByCategory.repairs,
    lodging: agg.expensesByCategory.lodging,
    misc: agg.expensesByCategory.misc,
  })

  // Compute business-level KPIs (with overhead)
  const pnlInput = pnlData ?? initialPnLData
  const pnl = calculatePnL(pnlInput)
  const unitMetrics = calculateUnitMetrics(pnlInput, pnl)

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-end">
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Section 1: Business KPIs (includes overhead) */}
      <BusinessKPICards pnl={pnl} unitMetrics={unitMetrics} />

      {/* Divider */}
      <div className="border-t border-border/50" />

      {/* Section 2: Trip Performance KPIs (direct costs only) */}
      <KPICards
        kpis={kpis}
        revenue={agg.totalRevenue}
      />

      {/* Row 2: Revenue Chart + Expense Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RevenueExpensesChart data={revenueByMonth} />
        </div>
        <div className="lg:col-span-4">
          <ExpenseBreakdownChart data={expenseBreakdown} totalExpenses={kpis.totalExpenses} />
        </div>
      </div>

      {/* Row 3: KPI Trends */}
      <KPITrendChart data={kpiTrend} />

      {/* Row 4: Profit by Truck + Profit by Driver */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfitByTruckTable data={profitByTruck ?? initialProfitByTruck} />
        <ProfitByDriverTable data={profitByDriver ?? initialProfitByDriver} />
      </div>

      {/* Row 5: Top Brokers */}
      <TopBrokersTable data={topBrokers} />
    </div>
  )
}
