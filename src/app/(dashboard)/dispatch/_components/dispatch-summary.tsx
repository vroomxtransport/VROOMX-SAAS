'use client'

import { cn } from '@/lib/utils'

interface DispatchSummaryProps {
  planned: number
  inProgress: number
  capacity: { used: number; total: number }
}

export function DispatchSummary({ planned, inProgress, capacity }: DispatchSummaryProps) {
  const capacityPercent = capacity.total > 0 ? Math.min((capacity.used / capacity.total) * 100, 100) : 0

  return (
    <div className="rounded-lg bg-surface border border-border-subtle p-3 flex items-center gap-6 flex-wrap">
      {/* Planned */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="text-xs text-muted-foreground">Planned</span>
        <span className="text-sm font-semibold text-foreground">{planned}</span>
      </div>

      {/* In Progress */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs text-muted-foreground">In Progress</span>
        <span className="text-sm font-semibold text-foreground">{inProgress}</span>
      </div>

      {/* Capacity */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Capacity</span>
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              capacityPercent >= 90 ? 'bg-red-500' : capacityPercent >= 70 ? 'bg-amber-500' : 'bg-brand'
            )}
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-foreground">
          {capacity.used}/{capacity.total}
        </span>
      </div>
    </div>
  )
}
