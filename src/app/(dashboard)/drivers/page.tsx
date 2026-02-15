import { Suspense } from 'react'
import { DriverList } from './_components/driver-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Drivers | VroomX',
}

export default function DriversPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Drivers"
        subtitle="Manage your fleet drivers, pay configuration, and status"
      />
      <Suspense fallback={null}>
        <DriverList />
      </Suspense>
    </div>
  )
}
