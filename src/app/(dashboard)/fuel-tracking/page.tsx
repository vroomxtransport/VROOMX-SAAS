import { Suspense } from 'react'
import { FuelList } from './_components/fuel-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Fuel Tracking | VroomX',
}

export default function FuelTrackingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel Tracking"
        subtitle="Track fuel purchases, costs, and consumption across your fleet"
      />
      <Suspense fallback={null}>
        <FuelList />
      </Suspense>
    </div>
  )
}
