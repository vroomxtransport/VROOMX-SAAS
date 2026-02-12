import { createClient } from '@/lib/supabase/server'
import {
  fetchBrokerReceivables,
  fetchAgingAnalysis,
  fetchCollectionRate,
} from '@/lib/queries/receivables'
import { ReceivablesTable } from './_components/receivables-table'
import { AgingTable } from './_components/aging-table'
import { CollectionRate } from './_components/collection-rate'
import { HelpTooltip } from '@/components/help-tooltip'

export default async function BillingPage() {
  const supabase = await createClient()

  const [receivables, aging, collection] = await Promise.all([
    fetchBrokerReceivables(supabase),
    fetchAgingAnalysis(supabase),
    fetchCollectionRate(supabase),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            Billing
            <HelpTooltip
              content="Track outstanding invoices and payment collection. Aging Analysis shows how long invoices have been unpaid."
              side="right"
            />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Track receivables, aging, and collection performance
          </p>
        </div>
        <CollectionRate
          totalInvoiced={collection.totalInvoiced}
          totalCollected={collection.totalCollected}
          rate={collection.rate}
        />
      </div>

      {/* Receivables Section */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Receivables by Broker
        </h2>
        <ReceivablesTable receivables={receivables} />
      </section>

      {/* Aging Analysis Section */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Aging Analysis</h2>
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
