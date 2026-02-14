'use client'

import { DispatchTripCard } from './dispatch-trip-card'
import { TRIP_STATUS_LABELS, TRIP_STATUSES } from '@/types'
import type { TripStatus } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

interface DispatchKanbanProps {
  groupedTrips: Record<TripStatus, TripWithRelations[]>
}

const SECTION_BORDER_COLORS: Record<TripStatus, string> = {
  planned: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  at_terminal: 'border-l-purple-500',
  completed: 'border-l-green-500',
}

const SECTION_BG_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-50/50 dark:bg-blue-950/20',
  in_progress: 'bg-amber-50/50 dark:bg-amber-950/20',
  at_terminal: 'bg-purple-50/50 dark:bg-purple-950/20',
  completed: 'bg-green-50/50 dark:bg-green-950/20',
}

const COUNT_BADGE_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  at_terminal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}

export function DispatchKanban({ groupedTrips }: DispatchKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {TRIP_STATUSES.map((status) => {
        const trips = groupedTrips[status]
        const count = trips.length

        return (
          <div key={status} className="flex-1 min-w-[280px] max-w-[340px]">
            {/* Column Header */}
            <div
              className={cn(
                'rounded-t-lg px-3 py-2.5 border-l-4 flex items-center justify-between',
                SECTION_BORDER_COLORS[status],
                SECTION_BG_COLORS[status]
              )}
            >
              <span className="text-sm font-semibold text-foreground">
                {TRIP_STATUS_LABELS[status]}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  COUNT_BADGE_COLORS[status]
                )}
              >
                {count}
              </span>
            </div>

            {/* Column Body */}
            <div className="space-y-2 p-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-380px)] rounded-b-lg border border-t-0 border-border-subtle bg-muted/30">
              {count === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground italic">
                  No trips
                </p>
              ) : (
                trips.map((trip) => (
                  <DispatchTripCard key={trip.id} trip={trip} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
