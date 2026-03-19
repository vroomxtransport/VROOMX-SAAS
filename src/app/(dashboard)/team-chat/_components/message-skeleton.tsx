import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-1/2', 'w-3/5']

export function MessageFeedSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {WIDTHS.map((width, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className={cn('h-4', width)} />
          </div>
        </div>
      ))}
    </div>
  )
}
