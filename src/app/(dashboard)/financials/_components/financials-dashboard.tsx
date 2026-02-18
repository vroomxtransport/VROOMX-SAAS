'use client'

import { useState } from 'react'
import type { FinancialPeriod, KPIAggregates, ProfitByTruck, ProfitByDriver, MonthlyKPITrend, MonthlyRevenue, TopBroker } from '@/lib/queries/financials'
import { calculateKPIs, calculateExpenseBreakdown } from '@/lib/financial/kpi-calculations'
import { PeriodSelector } from './period-selector'
import { KPICards } from './kpi-cards'
import { RevenueExpensesChart } from './revenue-expenses-chart'
import { ExpenseBreakdownChart } from './expense-breakdown-chart'
import { KPITrendChart } from './kpi-trend-chart'
import { ProfitByTruckTable } from './profit-by-truck-table'
import { ProfitByDriverTable } from './profit-by-driver-table'
import { TopBrokersTable } from './top-brokers-table'
import { createClient } from '@/lib/supabase/client'
import { fetchKPIAggregates, fetchProfitByTruck, fetchProfitByDriver } from '@/lib/queries/financials'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

interface FinancialsDashboardProps {
  initialAggregates: KPIAggregates
  initialProfitByTruck: ProfitByTruck[]
  initialProfitByDriver: ProfitByDriver[]
  kpiTrend: MonthlyKPITrend[]
  revenueByMonth: MonthlyRevenue[]
  topBrokers: TopBroker[]
}

export function FinancialsDashboard({
  initialAggregates,
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

  // Compute KPIs from aggregates
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

  return (
    <div className="space-y-6">
      {/* Period Selector + P&L Report Link */}
      <div className="flex items-center justify-between">
        <Link href="/financials/reports">
          <Button variant="outline" size="sm">
            <FileText className="mr-1.5 h-4 w-4" />
            Full P&L Report
          </Button>
        </Link>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Row 1: KPI Cards */}
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
