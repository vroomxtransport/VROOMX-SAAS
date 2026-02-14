import { Suspense } from 'react'
import { TruckList } from './_components/truck-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Fleet | VroomX',
}

export default function TrucksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        subtitle="Manage your trucks and fleet vehicles"
      />
      <Suspense fallback={null}>
        <TruckList />
      </Suspense>
    </div>
  )
}
