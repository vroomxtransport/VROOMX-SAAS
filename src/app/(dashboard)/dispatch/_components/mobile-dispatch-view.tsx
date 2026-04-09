'use client'

import { useCallback, useEffect, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { MobileTripCard } from './mobile-trip-card'
import { TRIP_STATUSES, TRIP_STATUS_LABELS } from '@/types'
import type { TripStatus } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

interface MobileDispatchViewProps {
  groupedTrips: Record<TripStatus, TripWithRelations[]>
}

const TAB_INDICATOR_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  at_terminal: 'bg-purple-500',
  completed: 'bg-green-500',
}

const TAB_COUNT_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  at_terminal: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
}

const TAB_ACTIVE_TEXT: Record<TripStatus, string> = {
  planned: 'text-blue-600',
  in_progress: 'text-amber-600',
  at_terminal: 'text-purple-600',
  completed: 'text-green-600',
}

export function MobileDispatchView({ groupedTrips }: MobileDispatchViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: false,
    loop: false,
  })

  // Keep selectedIndex in sync when user swipes
  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
    }
  }, [emblaApi, onSelect])

  // When tab pill is tapped, scroll carousel to that index
  const handleTabClick = useCallback(
    (index: number) => {
      setSelectedIndex(index)
      emblaApi?.scrollTo(index)
    },
    [emblaApi],
  )

  const activeStatus = TRIP_STATUSES[selectedIndex]

  return (
    <div className="flex flex-col min-h-0">
      {/* Horizontal scrollable tab bar */}
      <div
        className="flex overflow-x-auto gap-1 pb-1 mb-3 no-scrollbar"
        role="tablist"
        aria-label="Trip status tabs"
      >
        {TRIP_STATUSES.map((status, index) => {
          const count = groupedTrips[status].length
          const isActive = index === selectedIndex

          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`trip-panel-${status}`}
              id={`trip-tab-${status}`}
              onClick={() => handleTabClick(index)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2',
                'text-xs font-medium transition-all duration-150',
                'min-h-[36px] shrink-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
                isActive
                  ? cn('bg-surface border border-border-subtle shadow-sm', TAB_ACTIVE_TEXT[status])
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className={cn('h-1.5 w-1.5 rounded-full', TAB_INDICATOR_COLORS[status])} />
              )}
              <span>{TRIP_STATUS_LABELS[status]}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-semibold',
                  isActive ? TAB_COUNT_COLORS[status] : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Embla carousel — one panel per status */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {TRIP_STATUSES.map((status) => {
            const trips = groupedTrips[status]

            return (
              <div
                key={status}
                id={`trip-panel-${status}`}
                role="tabpanel"
                aria-labelledby={`trip-tab-${status}`}
                className="min-w-0 shrink-0 grow-0 basis-full"
              >
                {trips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <span className="text-sm text-muted-foreground">
                      No {TRIP_STATUS_LABELS[status].toLowerCase()} trips
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {trips.map((trip) => (
                      <MobileTripCard key={trip.id} trip={trip} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Swipe hint — subtle bottom indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4" aria-hidden="true">
        {TRIP_STATUSES.map((status, index) => (
          <button
            key={status}
            type="button"
            onClick={() => handleTabClick(index)}
            className={cn(
              'rounded-full transition-all duration-200',
              index === selectedIndex
                ? cn('w-4 h-1.5', TAB_INDICATOR_COLORS[status])
                : 'w-1.5 h-1.5 bg-muted-foreground/30',
            )}
            aria-label={`Go to ${TRIP_STATUS_LABELS[status]}`}
          />
        ))}
      </div>
    </div>
  )
}
