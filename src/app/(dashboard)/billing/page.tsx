import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import {
  fetchBrokerReceivables,
  fetchAgingAnalysis,
  fetchCollectionRate,
} from '@/lib/queries/receivables'
import { ReceivablesTable } from './_components/receivables-table'
import { AgingTable } from './_components/aging-table'
import { CollectionRate } from './_components/collection-rate'
import { ReadyToInvoice } from './_components/ready-to-invoice'
import { HelpTooltip } from '@/components/help-tooltip'
import { PageHeader } from '@/components/shared/page-header'

export default async function BillingPage() {
  const supabase = await createClient()

  const [receivables, aging, collection] = await Promise.all([
    fetchBrokerReceivables(supabase),
    fetchAgingAnalysis(supabase),
    fetchCollectionRate(supabase),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title="Billing" subtitle="Track receivables, aging, and collection performance">
        <HelpTooltip
          content="Track outstanding invoices and payment collection. Send invoices to brokers for delivered loads, then track aging and collection."
          side="right"
        />
        <CollectionRate
          totalInvoiced={collection.totalInvoiced}
          totalCollected={collection.totalCollected}
          rate={collection.rate}
        />
      </PageHeader>

      {/* Ready to Invoice — delivered loads not yet invoiced */}
      <Suspense fallback={null}>
        <ReadyToInvoice />
      </Suspense>

      {/* Receivables Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Receivables by Broker
        </h2>
        <ReceivablesTable receivables={receivables} />
      </section>

      {/* Aging Analysis Section */}
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
  )
}
