import { Suspense } from 'react'
import { EventsDashboard } from './_components/events-dashboard'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = { title: 'Safety Events | VroomX' }

function EventsDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function SafetyEventsPage() {
  return (
    <Suspense fallback={<EventsDashboardSkeleton />}>
      <EventsDashboard />
    </Suspense>
  )
}
