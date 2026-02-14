import { Suspense } from 'react'
import { DispatcherList } from './_components/dispatcher-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Dispatchers | VroomX' }

export default function DispatchersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dispatchers" subtitle="View your team's dispatchers and their activity" />
      <Suspense fallback={null}>
        <DispatcherList />
      </Suspense>
    </div>
  )
}
