import { Skeleton } from '@/components/ui/skeleton'

const WIDTHS = ['w-20', 'w-28', 'w-16', 'w-24', 'w-20']

export function ChannelListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {WIDTHS.map((width, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className={`h-4 ${width} rounded`} />
        </div>
      ))}
    </div>
  )
}
