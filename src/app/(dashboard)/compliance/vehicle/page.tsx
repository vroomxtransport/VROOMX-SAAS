import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { VehicleDashboard } from './_components/vehicle-dashboard'

export const metadata = { title: 'Vehicle Files | VroomX' }

function VehicleLoadingFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[76px] w-full rounded-xl" />
      <Skeleton className="h-[68px] w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function VehiclePage() {
  return (
    <Suspense fallback={<VehicleLoadingFallback />}>
      <VehicleDashboard />
    </Suspense>
  )
}
