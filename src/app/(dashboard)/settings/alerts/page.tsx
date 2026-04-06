import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AlertsDashboard } from './_components/alerts-dashboard'

export const metadata: Metadata = {
  title: 'Alert Rules | Settings | VroomX',
}

export default function AlertsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <AlertsDashboard />
    </Suspense>
  )
}
