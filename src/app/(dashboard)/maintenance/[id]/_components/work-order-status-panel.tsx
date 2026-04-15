'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS } from '@/types'
import type { MaintenanceStatus } from '@/types'
import { setWorkOrderStatus, isTransitionAllowed } from '@/app/actions/work-orders'

interface WorkOrderStatusPanelProps {
  workOrderId: string
  status: MaintenanceStatus
  canClose: boolean
}

const STATUS_ORDER: MaintenanceStatus[] = ['new', 'scheduled', 'in_progress', 'completed', 'closed']

const STATUS_BUTTON_LABELS: Partial<Record<MaintenanceStatus, string>> = {
  new: 'Reset to New',
  scheduled: 'Mark Scheduled',
  in_progress: 'Start Work',
  completed: 'Mark Completed',
  closed: 'Close',
}

export function WorkOrderStatusPanel({
  workOrderId,
  status,
  canClose,
}: WorkOrderStatusPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useState<MaintenanceStatus>(status)
  const currentStatus = optimisticStatus

  const colors = MAINTENANCE_STATUS_COLORS[currentStatus]
  const label = MAINTENANCE_STATUS_LABELS[currentStatus]

  const dotColor =
    currentStatus === 'new' ? 'bg-slate-400' :
    currentStatus === 'scheduled' ? 'bg-blue-400' :
    currentStatus === 'in_progress' ? 'bg-amber-400' :
    currentStatus === 'completed' ? 'bg-emerald-400' :
    'bg-zinc-400'

  const handleTransition = (to: MaintenanceStatus) => {
    if (!isTransitionAllowed(currentStatus, to)) return
    if (to === 'closed' && !canClose) {
      toast.error('You do not have permission to close work orders.')
      return
    }

    startTransition(async () => {
      setOptimisticStatus(to)
      const result = await setWorkOrderStatus({ id: workOrderId, status: to })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        setOptimisticStatus(currentStatus)
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to update status.'
        toast.error(msg)
        return
      }

      toast.success(`Status updated to ${MAINTENANCE_STATUS_LABELS[to]}`)
    })
  }

  const transitions = STATUS_ORDER.filter(
    (s) => s !== currentStatus && isTransitionAllowed(currentStatus, s),
  ).filter((s) => {
    if (s === 'closed') return canClose
    return true
  })

  return (
    <div className="widget-card p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>

      <Badge
        variant="outline"
        className={cn('gap-2 px-3 py-1.5 text-sm font-semibold', colors)}
      >
        <span className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', dotColor)} />
        {label}
      </Badge>

      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {transitions.map((to) => {
            const isClose = to === 'closed'
            return (
              <Button
                key={to}
                size="sm"
                variant={isClose ? 'destructive' : 'outline'}
                className={cn(
                  'h-7 text-xs',
                  !isClose && 'hover:border-[var(--brand)]/50 hover:text-[var(--brand)]',
                )}
                disabled={isPending}
                onClick={() => handleTransition(to)}
              >
                {STATUS_BUTTON_LABELS[to] ?? MAINTENANCE_STATUS_LABELS[to]}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
