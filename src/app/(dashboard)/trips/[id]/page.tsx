'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useTrip } from '@/hooks/use-trips'
import { TripDetail } from '../_components/trip-detail'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

export default function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { data: trip, isPending, isError, error } = useTrip(id)

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-4">
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 lg:col-span-2">
            <Skeleton className="mb-4 h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
          <div className="rounded-lg border bg-white p-6">
            <Skeleton className="mb-4 h-6 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dispatch')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dispatch
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load trip: {error?.message ?? 'Unknown error'}
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dispatch')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dispatch
        </Button>
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">
          Trip not found.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/dispatch')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dispatch
      </Button>

      <TripDetail trip={trip} />
    </div>
  )
}
