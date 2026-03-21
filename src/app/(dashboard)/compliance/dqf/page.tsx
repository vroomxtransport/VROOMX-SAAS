import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { DqfDashboard } from './_components/dqf-dashboard'

export const metadata = { title: 'Driver Files (DQF) | VroomX' }

function DqfLoadingFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[76px] w-full rounded-xl" />
      <Skeleton className="h-[68px] w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function DqfPage() {
  return (
    <Suspense fallback={<DqfLoadingFallback />}>
      <DqfDashboard />
    </Suspense>
  )
}
