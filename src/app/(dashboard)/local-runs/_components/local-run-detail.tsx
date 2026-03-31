'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useLocalRun } from '@/hooks/use-local-runs'
import { addDriveToRun, removeDriveFromRun } from '@/app/actions/local-runs'
import { fetchLocalDrives } from '@/lib/queries/local-drives'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  X,
  Play,
  CheckCircle2,
  Pencil,
  Trash2,
  Warehouse,
  User,
  Truck,
  Calendar,
  DollarSign,
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
import type { LocalDrive, LocalRun } from '@/types/database'

interface LocalRunDetailProps {
  runId: string
  onEdit: (run: LocalRun) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: LocalRunStatus) => void
}

function formatRoute(drive: LocalDrive): string {
  const pickup = [drive.pickup_city, drive.pickup_state].filter(Boolean).join(', ')
  const delivery = [drive.delivery_city, drive.delivery_state].filter(Boolean).join(', ')
  if (pickup && delivery) return `${pickup} → ${delivery}`
  if (pickup) return `From: ${pickup}`
  if (delivery) return `To: ${delivery}`
  return 'No route'
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num) || num === 0) return '$0'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function LocalRunDetail({ runId, onEdit, onDelete, onStatusChange }: LocalRunDetailProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: run, isPending } = useLocalRun(runId)

  const [removingDriveId, setRemovingDriveId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assigningAll, setAssigningAll] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  // Fetch available (unassigned) drives matching this run's terminal + type
  const { data: availableData } = useQuery({
    queryKey: ['unassigned-drives', run?.terminal_id, run?.type],
    queryFn: () =>
      fetchLocalDrives(supabase, {
        terminalId: run?.terminal_id || undefined,
        type: run?.type,
        status: 'pending',
        unassignedOnly: true,
        pageSize: 50,
      }),
    enabled: !!run,
    staleTime: 10_000,
  })

  const assignedDrives = (run?.local_drives ?? []) as LocalDrive[]
  const availableDrives = availableData?.localDrives ?? []

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['local-run', runId] })
    queryClient.invalidateQueries({ queryKey: ['local-runs'] })
    queryClient.invalidateQueries({ queryKey: ['unassigned-drives'] })
  }, [queryClient, runId])

  const handleAssign = useCallback(async (driveId: string) => {
    setAssigningId(driveId)
    try {
      await addDriveToRun(runId, driveId)
      invalidateAll()
    } finally {
      setAssigningId(null)
    }
  }, [runId, invalidateAll])

  const handleAssignAll = useCallback(async () => {
    setAssigningAll(true)
    try {
      for (const drive of availableDrives) {
        await addDriveToRun(runId, drive.id)
      }
      invalidateAll()
    } finally {
      setAssigningAll(false)
    }
  }, [runId, availableDrives, invalidateAll])

  const handleRemove = useCallback(async () => {
    if (!removingDriveId) return
    await removeDriveFromRun(removingDriveId)
    invalidateAll()
    setRemovingDriveId(null)
  }, [removingDriveId, invalidateAll])

  const handleStatus = useCallback(async (status: LocalRunStatus) => {
    setStatusLoading(true)
    try {
      await onStatusChange(runId, status)
    } finally {
      setStatusLoading(false)
    }
  }, [runId, onStatusChange])

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!run) return <p className="text-sm text-muted-foreground text-center py-8">Run not found</p>

  const terminalName = (run.terminal as { name: string } | null)?.name ?? 'No terminal'
  const driverName = run.driver
    ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}`
    : 'Unassigned'
  const truckUnit = (run.truck as { unit_number: string } | null)?.unit_number

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-lg font-semibold">{terminalName}</h3>
            <Badge variant="outline" className={`text-xs ${LOCAL_DRIVE_TYPE_COLORS[run.type as LocalDriveType]}`}>
              {LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType]}
            </Badge>
            <Badge variant="outline" className={`text-xs ${LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus]}`}>
              {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{driverName}</span>
            {truckUnit && <span className="flex items-center gap-1"><Truck className="h-3 w-3" />#{truckUnit}</span>}
            {run.scheduled_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{run.scheduled_date}</span>}
            {parseFloat(run.total_expense) > 0 && (
              <span className="flex items-center gap-1 font-medium text-foreground"><DollarSign className="h-3 w-3" />{formatCurrency(run.total_expense)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {run.status === 'planned' && (
            <Button size="sm" variant="outline" onClick={() => handleStatus('in_progress')} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          )}
          {run.status === 'in_progress' && (
            <Button size="sm" variant="outline" onClick={() => handleStatus('completed')} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onEdit(run)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(run.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Assigned Drives */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground/60" />
          Assigned Drives ({assignedDrives.length})
        </h4>
        {assignedDrives.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 px-2 rounded-md bg-muted/30">
            No drives assigned yet. Assign from the available drives below.
          </p>
        ) : (
          <div className="space-y-1">
            {assignedDrives.map((drive) => {
              const orderInfo = drive.order
                ? `#${(drive.order as { order_number: string }).order_number ?? ''} · ${(drive.order as { vehicle_make: string }).vehicle_make ?? ''} ${(drive.order as { vehicle_model: string }).vehicle_model ?? ''}`.trim()
                : null

              const driveContent = (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{formatRoute(drive)}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${LOCAL_DRIVE_STATUS_COLORS[drive.status as LocalDriveStatus]}`}>
                      {LOCAL_DRIVE_STATUS_LABELS[drive.status as LocalDriveStatus]}
                    </Badge>
                  </div>
                  {orderInfo && <p className="text-xs text-muted-foreground truncate">{orderInfo}</p>}
                </div>
              )

              return (
                <div key={drive.id} className="flex items-center justify-between rounded-md border px-3 py-2 bg-surface hover:bg-muted/30">
                  {drive.order_id ? (
                    <Link href={`/orders/${drive.order_id}`} className="min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                      {driveContent}
                    </Link>
                  ) : (
                    driveContent
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive shrink-0 ml-2"
                    onClick={(e) => { e.stopPropagation(); setRemovingDriveId(drive.id) }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Available Drives */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground/60" />
            Available Drives ({availableDrives.length})
          </h4>
          {availableDrives.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAssignAll}
              disabled={assigningAll || !!assigningId}
            >
              {assigningAll ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Assign All
            </Button>
          )}
        </div>
        {availableDrives.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 px-2 rounded-md bg-muted/30">
            No unassigned drives matching this terminal and type.
          </p>
        ) : (
          <div className="space-y-1">
            {availableDrives.map((drive) => {
              const isAssigning = assigningId === drive.id
              const orderInfo = drive.order
                ? `#${(drive.order as { order_number: string }).order_number ?? ''} · ${(drive.order as { vehicle_make: string }).vehicle_make ?? ''} ${(drive.order as { vehicle_model: string }).vehicle_model ?? ''}`.trim()
                : null

              return (
                <div key={drive.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{formatRoute(drive)}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${LOCAL_DRIVE_STATUS_COLORS[drive.status as LocalDriveStatus]}`}>
                        {LOCAL_DRIVE_STATUS_LABELS[drive.status as LocalDriveStatus]}
                      </Badge>
                    </div>
                    {orderInfo && <p className="text-xs text-muted-foreground truncate">{orderInfo}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 shrink-0 ml-2"
                    onClick={() => handleAssign(drive.id)}
                    disabled={!!assigningId || assigningAll}
                  >
                    {isAssigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Remove confirmation */}
      <ConfirmDialog
        open={!!removingDriveId}
        onOpenChange={(open) => { if (!open) setRemovingDriveId(null) }}
        title="Remove Drive"
        description="Remove this drive from the run? It will remain as an unassigned pending drive."
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </div>
  )
}
