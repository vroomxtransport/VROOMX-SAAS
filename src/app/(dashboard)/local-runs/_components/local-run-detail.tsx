'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalRun } from '@/hooks/use-local-runs'
import { removeDriveFromRun, updateLocalRunStatus } from '@/app/actions/local-runs'
import { AssignDriveDialog } from './assign-drive-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  X,
  Play,
  CheckCircle2,
  Warehouse,
  User,
  Truck,
  Calendar,
  DollarSign,
  Navigation,
  Loader2,
} from 'lucide-react'
import {
  LOCAL_RUN_STATUS_LABELS,
  LOCAL_RUN_STATUS_COLORS,
  LOCAL_DRIVE_TYPE_LABELS,
  LOCAL_DRIVE_TYPE_COLORS,
  LOCAL_DRIVE_STATUS_LABELS,
  LOCAL_DRIVE_STATUS_COLORS,
} from '@/types'
import type { LocalRunStatus, LocalDriveType, LocalDriveStatus } from '@/types'
import type { LocalDrive } from '@/types/database'

interface LocalRunDetailProps {
  runId: string
}

function formatRoute(drive: LocalDrive): string {
  const pickup = [drive.pickup_city, drive.pickup_state].filter(Boolean).join(', ')
  const delivery = [drive.delivery_city, drive.delivery_state].filter(Boolean).join(', ')
  if (pickup && delivery) return `${pickup} → ${delivery}`
  if (pickup) return `From: ${pickup}`
  if (delivery) return `To: ${delivery}`
  return 'No route set'
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return '$0'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function LocalRunDetail({ runId }: LocalRunDetailProps) {
  const queryClient = useQueryClient()
  const { data: run, isPending } = useLocalRun(runId)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [removingDriveId, setRemovingDriveId] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  const drives = (run?.local_drives ?? []) as LocalDrive[]

  const handleRemove = useCallback(async () => {
    if (!removingDriveId) return
    setIsRemoving(true)
    try {
      await removeDriveFromRun(removingDriveId)
      queryClient.invalidateQueries({ queryKey: ['local-run', runId] })
      queryClient.invalidateQueries({ queryKey: ['local-runs'] })
      queryClient.invalidateQueries({ queryKey: ['unassigned-drives'] })
    } finally {
      setIsRemoving(false)
      setRemovingDriveId(null)
    }
  }, [removingDriveId, runId, queryClient])

  const handleStatusChange = useCallback(async (status: LocalRunStatus) => {
    setStatusLoading(true)
    try {
      await updateLocalRunStatus(runId, status)
      queryClient.invalidateQueries({ queryKey: ['local-run', runId] })
      queryClient.invalidateQueries({ queryKey: ['local-runs'] })
    } finally {
      setStatusLoading(false)
    }
  }, [runId, queryClient])

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!run) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Run not found</div>
  }

  const terminalName = (run.terminal as { name: string } | null)?.name ?? 'No terminal'
  const driverName = run.driver
    ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}`
    : 'Unassigned'
  const truckUnit = (run.truck as { unit_number: string } | null)?.unit_number

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">{terminalName}</h3>
          <Badge variant="outline" className={`text-xs ${LOCAL_DRIVE_TYPE_COLORS[run.type as LocalDriveType]}`}>
            {LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType]}
          </Badge>
          <Badge variant="outline" className={`text-xs ${LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus]}`}>
            {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {run.status === 'planned' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              Start Run
            </Button>
          )}
          {run.status === 'in_progress' && (
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('completed')} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
              Complete
            </Button>
          )}
        </div>
      </div>

      {/* Info Row */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Warehouse className="h-3.5 w-3.5" />
          {terminalName}
        </span>
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {driverName}
        </span>
        {truckUnit && (
          <span className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            #{truckUnit}
          </span>
        )}
        {run.scheduled_date && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {run.scheduled_date}
          </span>
        )}
        {parseFloat(run.total_expense) > 0 && (
          <span className="flex items-center gap-1.5 font-medium">
            <DollarSign className="h-3.5 w-3.5" />
            {formatCurrency(run.total_expense)}
          </span>
        )}
      </div>

      {/* Assigned Drives */}
      <div className="rounded-lg border bg-surface">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-5 w-5 text-muted-foreground/60" />
            <h4 className="text-base font-semibold">Drives ({drives.length})</h4>
          </div>
          <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Drive
          </Button>
        </div>

        <div className="divide-y">
          {drives.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No drives assigned. Click &quot;Add Drive&quot; to assign local drives to this run.
            </div>
          ) : (
            drives.map((drive) => {
              const orderInfo = drive.order
                ? `#${(drive.order as { order_number: string }).order_number ?? ''} · ${(drive.order as { vehicle_make: string }).vehicle_make ?? ''} ${(drive.order as { vehicle_model: string }).vehicle_model ?? ''}`.trim()
                : null

              return (
                <div key={drive.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{formatRoute(drive)}</span>
                        <Badge variant="outline" className={`text-xs ${LOCAL_DRIVE_STATUS_COLORS[drive.status as LocalDriveStatus]}`}>
                          {LOCAL_DRIVE_STATUS_LABELS[drive.status as LocalDriveStatus]}
                        </Badge>
                      </div>
                      {orderInfo && (
                        <p className="text-xs text-muted-foreground">{orderInfo}</p>
                      )}
                    </div>
                    {parseFloat(drive.expense_amount || '0') > 0 && (
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {formatCurrency(drive.expense_amount)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-8 w-8 shrink-0 p-0 text-muted-foreground/60 hover:text-red-600"
                    onClick={() => setRemovingDriveId(drive.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Assign Dialog */}
      <AssignDriveDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        runId={runId}
        terminalId={run.terminal_id}
        runType={run.type}
      />

      {/* Remove Confirmation */}
      <ConfirmDialog
        open={!!removingDriveId}
        onOpenChange={(open) => {
          if (!open) setRemovingDriveId(null)
        }}
        title="Remove Drive from Run"
        description="This will unassign the drive from this run. The drive will remain as a pending local drive."
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </div>
  )
}
