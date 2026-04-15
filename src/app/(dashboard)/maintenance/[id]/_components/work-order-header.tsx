'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkOrderDetail } from '@/lib/queries/work-orders'
import { WorkOrderActionsMenu } from './work-order-actions-menu'

interface WorkOrderHeaderProps {
  wo: WorkOrderDetail
}

export function WorkOrderHeader({ wo }: WorkOrderHeaderProps) {
  const woLabel = wo.wo_number != null ? `WO #${wo.wo_number}` : `Work Order`
  const lastModified = new Date(wo.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-3">
      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
        <Link href="/maintenance" aria-label="Back to work orders">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>

      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{woLabel}</h1>
        {wo.description && (
          <span className="hidden truncate text-sm text-muted-foreground md:block">
            — {wo.description}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden text-xs text-muted-foreground sm:block">
          Updated {lastModified}
        </span>
        <WorkOrderActionsMenu wo={wo} />
      </div>
    </div>
  )
}
