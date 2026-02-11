'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'

// Linear progression of order statuses (cancelled is special)
const TIMELINE_STATUSES: OrderStatus[] = [
  'new',
  'assigned',
  'picked_up',
  'delivered',
  'invoiced',
  'paid',
]

interface OrderTimelineProps {
  currentStatus: OrderStatus
  createdAt: string
  actualPickupDate?: string | null
  actualDeliveryDate?: string | null
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function OrderTimeline({
  currentStatus,
  createdAt,
  actualPickupDate,
  actualDeliveryDate,
}: OrderTimelineProps) {
  const isCancelled = currentStatus === 'cancelled'
  const currentIndex = TIMELINE_STATUSES.indexOf(currentStatus)

  // For cancelled orders, find what the last completed status was (we show up to current)
  // cancelled_reason is displayed elsewhere, timeline just shows the X

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-[500px] items-start justify-between">
        {TIMELINE_STATUSES.map((status, index) => {
          const isCompleted = !isCancelled && currentIndex > index
          const isCurrent = !isCancelled && currentIndex === index
          const isFuture = !isCancelled && currentIndex < index

          // Determine the date to show beneath this step
          let dateLabel: string | null = null
          if (status === 'new' && (isCompleted || isCurrent)) {
            dateLabel = formatDate(createdAt)
          } else if (status === 'picked_up' && actualPickupDate && (isCompleted || isCurrent)) {
            dateLabel = formatDate(actualPickupDate)
          } else if (status === 'delivered' && actualDeliveryDate && (isCompleted || isCurrent)) {
            dateLabel = formatDate(actualDeliveryDate)
          }

          return (
            <div key={status} className="flex flex-1 flex-col items-center">
              {/* Dot and connecting line */}
              <div className="flex w-full items-center">
                {/* Left line */}
                {index > 0 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      isCompleted || isCurrent
                        ? 'bg-blue-500'
                        : isCancelled
                          ? 'bg-gray-200'
                          : 'bg-gray-200'
                    )}
                  />
                )}
                {index === 0 && <div className="flex-1" />}

                {/* Circle */}
                <div
                  className={cn(
                    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted &&
                      'border-blue-500 bg-blue-500 text-white',
                    isCurrent &&
                      'border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-100',
                    isFuture &&
                      'border-gray-300 bg-white text-gray-400',
                    isCancelled &&
                      'border-gray-300 bg-white text-gray-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isCancelled ? (
                    <X className="h-4 w-4 text-gray-400" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Right line */}
                {index < TIMELINE_STATUSES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1',
                      isCompleted ? 'bg-blue-500' : 'bg-gray-200'
                    )}
                  />
                )}
                {index === TIMELINE_STATUSES.length - 1 && <div className="flex-1" />}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-center text-xs font-medium',
                  isCompleted && 'text-blue-600',
                  isCurrent && 'text-blue-700 font-semibold',
                  isFuture && 'text-gray-400',
                  isCancelled && 'text-gray-400'
                )}
              >
                {ORDER_STATUS_LABELS[status]}
              </span>

              {/* Date */}
              {dateLabel && (
                <span className="mt-0.5 text-center text-[10px] text-gray-500">
                  {dateLabel}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Cancelled overlay indicator */}
      {isCancelled && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-2">
          <X className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700">Order Cancelled</span>
        </div>
      )}
    </div>
  )
}
