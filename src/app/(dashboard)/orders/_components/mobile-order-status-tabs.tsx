'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/types'
import type { OrderStatus } from '@/types'

// Status accent colors mirror order-card status border colors
const STATUS_ACTIVE_CLASSES: Record<OrderStatus, string> = {
  new: 'bg-blue-500 text-white',
  assigned: 'bg-amber-500 text-white',
  picked_up: 'bg-orange-500 text-white',
  delivered: 'bg-green-500 text-white',
  invoiced: 'bg-purple-500 text-white',
  paid: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-500 text-white',
}

interface MobileOrderStatusTabsProps {
  activeStatus: string | null
  onStatusChange: (status: string | null) => void
  counts: Record<string, number>
}

export function MobileOrderStatusTabs({
  activeStatus,
  onStatusChange,
  counts,
}: MobileOrderStatusTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalCount = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-1.5 overflow-x-auto snap-x snap-mandatory px-1',
        // Hide scrollbar cross-browser while keeping it functional
        'scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        'pb-0.5' // breathing room for active shadows
      )}
      role="tablist"
      aria-label="Filter orders by status"
    >
      {/* All tab */}
      <button
        role="tab"
        aria-selected={activeStatus === null}
        onClick={() => onStatusChange(null)}
        className={cn(
          'snap-start flex-shrink-0 min-w-fit px-3 py-1.5 rounded-full text-xs font-medium',
          'transition-all duration-150 active:scale-95',
          activeStatus === null
            ? 'bg-foreground text-background shadow-sm'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        All
        {totalCount > 0 && (
          <span className={cn(
            'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold leading-none',
            activeStatus === null
              ? 'bg-background/20 text-current'
              : 'bg-muted-foreground/20 text-muted-foreground'
          )}>
            {totalCount > 999 ? '999+' : totalCount}
          </span>
        )}
      </button>

      {/* Per-status tabs */}
      {ORDER_STATUSES.map((status) => {
        const isActive = activeStatus === status
        const count = counts[status] ?? 0

        return (
          <button
            key={status}
            role="tab"
            aria-selected={isActive}
            onClick={() => onStatusChange(status)}
            className={cn(
              'snap-start flex-shrink-0 min-w-fit px-3 py-1.5 rounded-full text-xs font-medium',
              'transition-all duration-150 active:scale-95',
              isActive
                ? cn('shadow-sm', STATUS_ACTIVE_CLASSES[status])
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {ORDER_STATUS_LABELS[status]}
            {count > 0 && (
              <span className={cn(
                'ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-bold leading-none',
                isActive
                  ? 'bg-white/20 text-current'
                  : 'bg-muted-foreground/20 text-muted-foreground'
              )}>
                {count > 999 ? '999+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
