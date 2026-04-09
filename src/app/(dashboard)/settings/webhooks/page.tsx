import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WebhooksDashboard } from './_components/webhooks-dashboard'

export const metadata: Metadata = {
  title: 'Webhooks | Settings | VroomX',
}

export default function WebhooksSettingsPage() {
  return (
    <Suspense fallback={null}>
      <WebhooksDashboard />
    </Suspense>
  )
}
