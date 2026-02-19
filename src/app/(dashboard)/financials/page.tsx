import { createClient } from '@/lib/supabase/server'
import {
  fetchKPIAggregates,
  fetchProfitByTruck,
  fetchProfitByDriver,
  fetchMonthlyKPITrend,
  fetchRevenueByMonth,
  fetchTopBrokersByRevenue,
  fetchPnLData,
} from '@/lib/queries/financials'
import type { KPIAggregates, ProfitByTruck, ProfitByDriver, MonthlyKPITrend, MonthlyRevenue, TopBroker } from '@/lib/queries/financials'
import type { PnLInput } from '@/lib/financial/pnl-calculations'
import { FinancialsDashboard } from './_components/financials-dashboard'

// Safe wrapper that logs and returns a fallback on error
async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[Financials] ${name} failed:`, err)
    return fallback
  }
}

const emptyAggregates: KPIAggregates = {
  totalRevenue: 0, totalBrokerFees: 0, totalLocalFees: 0, totalDriverPay: 0,
  totalTripExpenses: 0, totalCarrierPay: 0, totalMiles: 0,
  orderCount: 0, truckCount: 0, completedTripCount: 0,
  expensesByCategory: { fuel: 0, tolls: 0, repairs: 0, lodging: 0, misc: 0 },
}

const emptyPnLInput: PnLInput = {
  totalRevenue: 0, totalBrokerFees: 0, totalLocalFees: 0,
  totalDriverPay: 0, fuelCosts: 0, tollCosts: 0, maintenanceCosts: 0,
  lodgingCosts: 0, miscCosts: 0, totalCarrierPay: 0,
  fixedExpensesByCategory: {}, totalFixedExpenses: 0,
  truckCount: 0, completedTripCount: 0, carsHauled: 0,
  totalMiles: 0, orderCount: 0,
}

export default async function FinancialsPage() {
  const supabase = await createClient()

  const [
    aggregates,
    pnlData,
    profitByTruck,
    profitByDriver,
    kpiTrend,
    revenueByMonth,
    topBrokers,
  ] = await Promise.all([
    safeQuery<KPIAggregates>('fetchKPIAggregates', () => fetchKPIAggregates(supabase, 'mtd'), emptyAggregates),
    safeQuery<PnLInput>('fetchPnLData', () => fetchPnLData(supabase, 'mtd'), emptyPnLInput),
    safeQuery<ProfitByTruck[]>('fetchProfitByTruck', () => fetchProfitByTruck(supabase, 'mtd'), []),
    safeQuery<ProfitByDriver[]>('fetchProfitByDriver', () => fetchProfitByDriver(supabase, 'mtd'), []),
    safeQuery<MonthlyKPITrend[]>('fetchMonthlyKPITrend', () => fetchMonthlyKPITrend(supabase, 6), []),
    safeQuery<MonthlyRevenue[]>('fetchRevenueByMonth', () => fetchRevenueByMonth(supabase), []),
    safeQuery<TopBroker[]>('fetchTopBrokersByRevenue', () => fetchTopBrokersByRevenue(supabase), []),
  ])

  return (
    <FinancialsDashboard
      initialAggregates={aggregates}
      initialPnLData={pnlData}
      initialProfitByTruck={profitByTruck}
      initialProfitByDriver={profitByDriver}
      kpiTrend={kpiTrend}
      revenueByMonth={revenueByMonth}
      topBrokers={topBrokers}
    />
  )
}
