import { createClient } from '@/lib/supabase/server'
import {
  fetchBrokerReceivables,
  fetchAgingAnalysis,
  fetchCollectionRate,
} from '@/lib/queries/receivables'
import { ReceivablesTable } from './_components/receivables-table'
import { AgingTable } from './_components/aging-table'
import { CollectionRate } from './_components/collection-rate'

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
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
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
        <AgingTable aging={aging} />
      </section>
    </div>
  )
}
