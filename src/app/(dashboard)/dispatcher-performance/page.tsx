import { Suspense } from 'react'
import { PerformanceStats } from './_components/performance-stats'
import { PerformanceTable } from './_components/performance-table'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Dispatcher Performance | VroomX' }

export default function DispatcherPerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dispatcher Performance" subtitle="Track team productivity, order completion, and revenue metrics" />
      <Suspense fallback={null}>
        <PerformanceStats />
      </Suspense>
      <Suspense fallback={null}>
        <PerformanceTable />
      </Suspense>
    </div>
  )
}
