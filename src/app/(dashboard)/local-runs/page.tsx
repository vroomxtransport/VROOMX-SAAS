import { Suspense } from 'react'
import { LocalRunList } from './_components/local-run-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Local Runs | VroomX',
}

export default function LocalRunsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Local Runs"
        subtitle="Group local drives into batched runs by driver and terminal"
      />
      <Suspense fallback={null}>
        <LocalRunList />
      </Suspense>
    </div>
  )
}
