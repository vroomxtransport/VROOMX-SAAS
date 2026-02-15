import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  fetchBrokerReceivables,
  fetchAgingAnalysis,
  fetchCollectionRate,
  fetchOutstandingAR,
  fetchInvoicedMTD,
  fetchCollectedMTD,
  fetchPaymentStatusBreakdown,
  fetchRecentPayments,
} from '@/lib/queries/receivables'
import type {
  PaymentStatusBreakdown,
  RecentPayment,
  BrokerReceivable,
  AgingRow,
  CollectionRate,
} from '@/lib/queries/receivables'
import { ReceivablesTable } from './_components/receivables-table'
import { AgingTable } from './_components/aging-table'
import { BillingKPICards } from './_components/billing-kpi-cards'
import { PaymentStatusCards } from './_components/payment-status-cards'
import { RecentPaymentsTable } from './_components/recent-payments-table'
import { ReadyToInvoice } from './_components/ready-to-invoice'
import { HelpTooltip } from '@/components/help-tooltip'
import { PageHeader } from '@/components/shared/page-header'

// Safe wrapper that logs and returns a fallback on error
async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[Billing] ${name} failed:`, err)
    return fallback
  }
}

export default async function BillingPage() {
  const supabase = await createClient()

  const [
    receivables,
    aging,
    collection,
    outstandingAR,
    invoicedMTD,
    collectedMTD,
    paymentStatus,
    recentPayments,
  ] = await Promise.all([
    safeQuery<BrokerReceivable[]>('fetchBrokerReceivables', () => fetchBrokerReceivables(supabase), []),
    safeQuery<AgingRow[]>('fetchAgingAnalysis', () => fetchAgingAnalysis(supabase), []),
    safeQuery<CollectionRate>('fetchCollectionRate', () => fetchCollectionRate(supabase), { totalInvoiced: 0, totalCollected: 0, rate: 0 }),
    safeQuery<number>('fetchOutstandingAR', () => fetchOutstandingAR(supabase), 0),
    safeQuery<number>('fetchInvoicedMTD', () => fetchInvoicedMTD(supabase), 0),
    safeQuery<number>('fetchCollectedMTD', () => fetchCollectedMTD(supabase), 0),
    safeQuery<PaymentStatusBreakdown[]>('fetchPaymentStatusBreakdown', () => fetchPaymentStatusBreakdown(supabase), []),
    safeQuery<RecentPayment[]>('fetchRecentPayments', () => fetchRecentPayments(supabase), []),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Billing" subtitle="Invoicing, payments, receivables, and collections">
        <HelpTooltip
          content="Track outstanding invoices and payment collection. Send invoices to brokers for delivered loads, then track aging and collection."
          side="right"
        />
      </PageHeader>

      {/* Row 1: Billing KPI Cards */}
      <BillingKPICards
        outstandingAR={outstandingAR}
        collectionRate={collection.rate}
        invoicedMTD={invoicedMTD}
        collectedMTD={collectedMTD}
      />

      {/* Row 2: Ready to Invoice */}
      <Suspense fallback={null}>
        <ReadyToInvoice />
      </Suspense>

      {/* Row 3: Payment Overview */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Payment Overview</h2>
        <PaymentStatusCards data={paymentStatus} />
      </section>

      {/* Row 4: Receivables by Broker + Aging Analysis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Receivables by Broker
          </h2>
          <ReceivablesTable receivables={receivables} />
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Aging Analysis</h2>
            <HelpTooltip
              content="Invoices grouped by how long they have been outstanding. Aim to keep the 60+ days bucket minimal."
              side="right"
            />
          </div>
          <AgingTable aging={aging} />
        </section>
      </div>

      {/* Row 5: Recent Payments */}
      <section>
        <RecentPaymentsTable data={recentPayments} />
      </section>
    </div>
  )
}
