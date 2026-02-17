'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'

const TIMELINE_STATUSES: OrderStatus[] = [
  'new',
  'assigned',
  'picked_up',
  'delivered',
  'invoiced',
  'paid',
]

interface OrderTimelineEnhancedProps {
  currentStatus: OrderStatus
  createdAt: string
  actualPickupDate?: string | null
  actualDeliveryDate?: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function OrderTimelineEnhanced({
  currentStatus,
  createdAt,
  actualPickupDate,
  actualDeliveryDate,
}: OrderTimelineEnhancedProps) {
  const isCancelled = currentStatus === 'cancelled'
  const currentIndex = TIMELINE_STATUSES.indexOf(currentStatus)

  function getDateLabel(status: OrderStatus, index: number): string | null {
    const isCompleted = !isCancelled && currentIndex > index
    const isCurrent = !isCancelled && currentIndex === index
    if (status === 'new' && (isCompleted || isCurrent)) return formatDate(createdAt)
    if (status === 'picked_up' && actualPickupDate && (isCompleted || isCurrent)) return formatDate(actualPickupDate)
    if (status === 'delivered' && actualDeliveryDate && (isCompleted || isCurrent)) return formatDate(actualDeliveryDate)
    return null
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          {TIMELINE_STATUSES.map((status, index) => {
            const isCompleted = !isCancelled && currentIndex > index
            const isCurrent = !isCancelled && currentIndex === index
            const isFuture = !isCancelled && currentIndex < index

            return (
              <div key={status} className="flex flex-1 items-center">
                {/* Connecting line before circle (except first) */}
                {index > 0 && (
                  <div
                    className={cn(
                      'h-1 flex-1 mx-2 transition-all duration-700',
                      isCompleted || isCurrent ? 'bg-brand' : 'bg-border-subtle'
                    )}
                  />
                )}

                {/* Circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                      isCompleted && 'bg-brand text-white',
                      isCurrent && 'border-2 border-brand bg-brand/10 text-brand ring-4 ring-brand/10',
                      isFuture && 'border-2 border-border-subtle bg-surface text-muted-foreground',
                      isCancelled && 'border-2 border-border-subtle bg-surface text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : isCurrent ? (
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-brand" />
                      </span>
                    ) : isCancelled ? (
                      <X className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </div>

                  {/* Label below circle */}
                  <span
                    className={cn(
                      'mt-2 text-center text-xs font-medium whitespace-nowrap',
                      isCompleted && 'text-brand',
                      isCurrent && 'text-brand font-semibold',
                      isFuture && 'text-muted-foreground',
                      isCancelled && 'text-muted-foreground'
                    )}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </span>

                  {/* Date */}
                  {getDateLabel(status, index) && (
                    <span className="mt-0.5 text-center text-[10px] text-muted-foreground">
                      {getDateLabel(status, index)}
                    </span>
                  )}
                </div>

                {/* Connecting line after circle (except last) */}
                {index < TIMELINE_STATUSES.length - 1 && (
                  <div
                    className={cn(
                      'h-1 flex-1 mx-2 transition-all duration-700',
                      isCompleted ? 'bg-brand' : 'bg-border-subtle'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: vertical stepper */}
      <div className="sm:hidden">
        <div className="flex flex-col gap-0">
          {TIMELINE_STATUSES.map((status, index) => {
            const isCompleted = !isCancelled && currentIndex > index
            const isCurrent = !isCancelled && currentIndex === index
            const isFuture = !isCancelled && currentIndex < index
            const dateLabel = getDateLabel(status, index)

            return (
              <div key={status} className="flex items-start gap-3">
                {/* Circle column */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                      isCompleted && 'bg-brand text-white',
                      isCurrent && 'border-2 border-brand bg-brand/10 text-brand ring-4 ring-brand/10',
                      isFuture && 'border-2 border-border-subtle bg-surface text-muted-foreground',
                      isCancelled && 'border-2 border-border-subtle bg-surface text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
                      </span>
                    ) : isCancelled ? (
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <span className="text-[10px] font-semibold">{index + 1}</span>
                    )}
                  </div>
                  {/* Vertical line */}
                  {index < TIMELINE_STATUSES.length - 1 && (
                    <div
                      className={cn(
                        'w-0.5 h-6 transition-all duration-700',
                        isCompleted ? 'bg-brand' : 'bg-border-subtle'
                      )}
                    />
                  )}
                </div>

                {/* Label column */}
                <div className="pt-1 pb-3">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isCompleted && 'text-brand',
                      isCurrent && 'text-brand font-semibold',
                      isFuture && 'text-muted-foreground',
                      isCancelled && 'text-muted-foreground'
                    )}
                  >
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                  {dateLabel && (
                    <span className="ml-2 text-[10px] text-muted-foreground">{dateLabel}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cancelled overlay */}
      {isCancelled && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <X className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">Order Cancelled</span>
        </div>
      )}
    </div>
  )
}
