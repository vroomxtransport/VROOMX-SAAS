'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useWorkOrder } from '@/hooks/use-work-order'
import type { WorkOrderDetail as WorkOrderDetailType } from '@/lib/queries/work-orders'
import { WorkOrderHeader } from './work-order-header'
import { WorkOrderShopCard } from './work-order-shop-card'
import { WorkOrderCustomerCard } from './work-order-customer-card'
import { WorkOrderEquipmentCard } from './work-order-equipment-card'
import { WorkOrderStatusPanel } from './work-order-status-panel'
import { WorkOrderItemsGrid } from './work-order-items-grid'
import { WorkOrderAttachments } from './work-order-attachments'
import { WorkOrderNotes } from './work-order-notes'
import { WorkOrderActivityLog } from './work-order-activity-log'
import { WorkOrderAccountingPanel } from './work-order-accounting-panel'
import type { MaintenanceStatus } from '@/types'

interface WorkOrderDetailProps {
  /** Server-side hydrated snapshot — used on first render, then revalidated by hook */
  initialData: WorkOrderDetailType
  canClose: boolean
  tenantName: string
}

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-7 w-44" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="widget-card p-4 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkOrderDetail({ initialData, canClose, tenantName }: WorkOrderDetailProps) {
  const { data: liveData, isPending } = useWorkOrder(initialData.id)

  // Prefer live data over SSR snapshot; fall back during initial load
  const wo = (liveData ?? initialData) as WorkOrderDetailType

  if (isPending && !liveData) {
    return <DetailSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <WorkOrderHeader wo={wo} />

      {/* 3-column header rail */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <WorkOrderShopCard workOrderId={wo.id} shop={wo.shop} />
        <WorkOrderCustomerCard tenantName={tenantName} />
        <WorkOrderEquipmentCard workOrderId={wo.id} wo={wo} />
      </div>

      {/* Status panel — full width, sits between rail and items grid */}
      <WorkOrderStatusPanel
        workOrderId={wo.id}
        status={wo.status as MaintenanceStatus}
        canClose={canClose}
      />

      {/* Items grid */}
      <WorkOrderItemsGrid workOrderId={wo.id} items={wo.items} />

      {/* Footer: attachments + notes + activity log (left 2 cols) + accounting (right col) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <WorkOrderAttachments
            workOrderId={wo.id}
            attachments={wo.attachments}
          />
          <WorkOrderNotes workOrderId={wo.id} notes={wo.noteEntries} />
          <WorkOrderActivityLog activityLog={wo.activityLog} />
        </div>
        <div>
          <WorkOrderAccountingPanel wo={wo} />
        </div>
      </div>
    </div>
  )
}
