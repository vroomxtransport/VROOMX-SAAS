import { Suspense } from 'react'
import { LocalDriveList } from './_components/local-drive-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Local Drives | VroomX',
}

export default function LocalDrivesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Local Drives"
        subtitle="Manage short-distance vehicle transports"
      />
      <Suspense fallback={null}>
        <LocalDriveList />
      </Suspense>
    </div>
  )
}
