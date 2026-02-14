import { Suspense } from 'react'
import { MaintenanceList } from './_components/maintenance-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Maintenance | VroomX' }

export default function MaintenancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" subtitle="Track vehicle maintenance, repairs, and inspections" />
      <Suspense fallback={null}>
        <MaintenanceList />
      </Suspense>
    </div>
  )
}
