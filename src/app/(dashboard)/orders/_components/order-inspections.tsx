'use client'

import { ClipboardCheck } from 'lucide-react'

interface OrderInspectionsProps {
  orderId?: string
}

export function OrderInspections({ orderId: _orderId }: OrderInspectionsProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">BOL & Inspections</h2>
      </div>

      {/* Inspection rows */}
      <div className="space-y-3">
        {/* Pickup Inspection */}
        <div className="rounded-lg bg-accent/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Pickup Inspection</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Pending
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Awaiting pickup</span>
        </div>

        {/* Delivery Inspection */}
        <div className="rounded-lg bg-accent/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Delivery Inspection</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Pending
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Awaiting delivery</span>
        </div>
      </div>
    </div>
  )
}
