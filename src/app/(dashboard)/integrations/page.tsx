import { getSamsaraStatus } from '@/app/actions/samsara'
import { IntegrationsHub } from './_components/integrations-hub'

export const metadata = {
  title: 'Integrations | VroomX',
  description: 'Connect your fleet tools to supercharge VroomX.',
}

export default async function IntegrationsPage() {
  const samsaraResult = await getSamsaraStatus()

  const samsaraConnected =
    'success' in samsaraResult && samsaraResult.data.connected

  const samsaraLastSync =
    'success' in samsaraResult ? samsaraResult.data.lastSyncAt : null

  return (
    <IntegrationsHub
      connectedSlugs={samsaraConnected ? ['samsara'] : []}
      lastSyncMap={samsaraLastSync ? { samsara: samsaraLastSync } : {}}
    />
  )
}
