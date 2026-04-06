import { createClient } from '@/lib/supabase/server'
import { fetchBrokerScorecard } from '@/lib/queries/broker-scorecard'
import type { BrokerScore } from '@/lib/queries/broker-scorecard'
import { BrokerScorecardDashboard } from './_components/broker-scorecard-dashboard'
import { PageHeader } from '@/components/shared/page-header'

async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message: string }).message
          : 'Unknown error'
    console.warn(`[BrokerScorecard] ${name} skipped:`, message)
    return fallback
  }
}

export default async function BrokerScorecardPage() {
  const supabase = await createClient()

  const initialScores = await safeQuery<BrokerScore[]>(
    'fetchBrokerScorecard',
    () => fetchBrokerScorecard(supabase),
    []
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broker Scorecard"
        subtitle="Evaluate broker relationships by profitability, reliability, and payment speed"
      />
      <BrokerScorecardDashboard initialScores={initialScores} />
    </div>
  )
}
