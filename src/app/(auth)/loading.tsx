import { Skeleton } from '@/components/ui/skeleton'

export default function AuthLoading() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {/* Logo / heading skeleton */}
        <div className="mb-6 text-center">
          <Skeleton className="mx-auto h-8 w-36" />
          <Skeleton className="mx-auto mt-2 h-4 w-56" />
        </div>

        {/* Form field skeletons */}
        <div className="space-y-4">
          <div>
            <Skeleton className="mb-1.5 h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div>
            <Skeleton className="mb-1.5 h-4 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>

        {/* Submit button skeleton */}
        <Skeleton className="mt-6 h-9 w-full" />

        {/* Footer link skeleton */}
        <Skeleton className="mx-auto mt-4 h-4 w-48" />
      </div>
    </div>
  )
}
