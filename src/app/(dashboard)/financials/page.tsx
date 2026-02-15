import { createClient } from '@/lib/supabase/server'
import {
  fetchFinancialSummary,
  fetchRevenueByMonth,
  fetchPaymentStatusBreakdown,
  fetchTopBrokersByRevenue,
  fetchRecentPayments,
} from '@/lib/queries/financials'
import { StatCard } from '@/components/shared/stat-card'
import { PageHeader } from '@/components/shared/page-header'
import { DollarSign, TrendingDown, TrendingUp, CreditCard } from 'lucide-react'
import { RevenueExpensesChart } from './_components/revenue-expenses-chart'
import { PaymentStatusCards } from './_components/payment-status-cards'
import { TopBrokersTable } from './_components/top-brokers-table'
import { RecentPaymentsTable } from './_components/recent-payments-table'

export default async function FinancialsPage() {
  const supabase = await createClient()

  const [summary, revenueByMonth, paymentStatus, topBrokers, recentPayments] = await Promise.all([
    fetchFinancialSummary(supabase),
    fetchRevenueByMonth(supabase),
    fetchPaymentStatusBreakdown(supabase),
    fetchTopBrokersByRevenue(supabase),
    fetchRecentPayments(supabase),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Financials" subtitle="Revenue, expenses, and payment overview" />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue MTD"
          value={`$${summary.revenueMTD.toLocaleString()}`}
          icon={DollarSign}
          accent="blue"
        />
        <StatCard
          label="Expenses MTD"
          value={`$${summary.expensesMTD.toLocaleString()}`}
          icon={TrendingDown}
          accent="amber"
        />
        <StatCard
          label="Net Profit MTD"
          value={`$${summary.netProfitMTD.toLocaleString()}`}
          icon={TrendingUp}
          accent={summary.netProfitMTD >= 0 ? 'emerald' : 'amber'}
        />
        <StatCard
          label="Outstanding AR"
          value={`$${summary.outstandingReceivables.toLocaleString()}`}
          icon={CreditCard}
          accent="violet"
        />
      </div>

      {/* Chart + Payment Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <RevenueExpensesChart data={revenueByMonth} />
        </div>
        <div className="lg:col-span-4">
          <PaymentStatusCards data={paymentStatus} />
        </div>
      </div>

      {/* Brokers + Recent Payments */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <TopBrokersTable data={topBrokers} />
        </div>
        <div className="lg:col-span-5">
          <RecentPaymentsTable data={recentPayments} />
        </div>
      </div>
    </div>
  )
}
