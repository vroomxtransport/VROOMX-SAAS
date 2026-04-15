'use client'

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

export function WorkOrderDetail({ initialData, canClose, tenantName }: WorkOrderDetailProps) {
  // SSR is the source of truth. Mutations call router.refresh() which re-runs
  // the parent server component and delivers fresh initialData. We previously
  // also consumed useWorkOrder, but its 15 s staleTime overrode router.refresh
  // and silently held the stale snapshot for up to 15 s — defeating UX-1.
  const wo = initialData

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
