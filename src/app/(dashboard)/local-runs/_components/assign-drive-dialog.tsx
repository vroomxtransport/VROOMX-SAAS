'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { addDriveToRun } from '@/app/actions/local-runs'
import { fetchLocalDrives } from '@/lib/queries/local-drives'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Loader2, Navigation } from 'lucide-react'
import { LOCAL_DRIVE_STATUS_LABELS, LOCAL_DRIVE_STATUS_COLORS } from '@/types'
import type { LocalDriveStatus } from '@/types'
import type { LocalDrive } from '@/types/database'

interface AssignDriveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: string
  terminalId: string | null
  runType: string
}

function formatRoute(drive: LocalDrive): string {
  const pickup = [drive.pickup_city, drive.pickup_state].filter(Boolean).join(', ')
  const delivery = [drive.delivery_city, drive.delivery_state].filter(Boolean).join(', ')
  if (pickup && delivery) return `${pickup} → ${delivery}`
  if (pickup) return `From: ${pickup}`
  if (delivery) return `To: ${delivery}`
  return 'No route set'
}

export function AssignDriveDialog({
  open,
  onOpenChange,
  runId,
  terminalId,
  runType,
}: AssignDriveDialogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assigningAll, setAssigningAll] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  useEffect(() => {
    if (open) {
      setSearch('')
      setDebouncedSearch('')
    }
  }, [open])

  // Fetch unassigned drives matching this run's terminal and type
  const { data, isPending } = useQuery({
    queryKey: ['unassigned-drives', terminalId, runType, debouncedSearch],
    queryFn: () =>
      fetchLocalDrives(supabase, {
        terminalId: terminalId || undefined,
        type: runType,
        status: 'pending',
        unassignedOnly: true,
        search: debouncedSearch || undefined,
        pageSize: 100,
      }),
    enabled: open,
    staleTime: 10_000,
  })

  const drives = data?.localDrives ?? []

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['unassigned-drives'] })
    queryClient.invalidateQueries({ queryKey: ['local-run'] })
    queryClient.invalidateQueries({ queryKey: ['local-runs'] })
    queryClient.invalidateQueries({ queryKey: ['local-drives'] })
  }, [queryClient])

  const handleAssign = useCallback(async (driveId: string) => {
    setAssigningId(driveId)
    try {
      const result = await addDriveToRun(runId, driveId)
      if ('error' in result && result.error) {
        console.error('Failed to assign drive:', result.error)
        return
      }
      invalidateAll()
    } finally {
      setAssigningId(null)
    }
  }, [runId, invalidateAll])

  const handleAssignAll = useCallback(async () => {
    setAssigningAll(true)
    try {
      for (const drive of drives) {
        const result = await addDriveToRun(runId, drive.id)
        if ('error' in result && result.error) {
          console.error('Failed to assign drive:', result.error)
          break
        }
      }
      invalidateAll()
    } finally {
      setAssigningAll(false)
    }
  }, [runId, drives, invalidateAll])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Drives to Run</DialogTitle>
          <DialogDescription>
            Showing unassigned local drives matching this run&apos;s terminal and type.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search by city or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {drives.length > 0 && (
            <Button
              size="sm"
              onClick={handleAssignAll}
              disabled={assigningAll || !!assigningId}
            >
              {assigningAll ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3.5 w-3.5" />
              )}
              Assign All ({drives.length})
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y rounded-md border">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
            </div>
          ) : drives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Navigation className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch
                  ? `No matching unassigned drives found.`
                  : 'No unassigned drives available for this terminal and type.'}
              </p>
            </div>
          ) : (
            drives.map((drive) => {
              const isAssigning = assigningId === drive.id
              const orderInfo = drive.order
                ? `#${(drive.order as { order_number: string }).order_number ?? ''} · ${(drive.order as { vehicle_make: string }).vehicle_make ?? ''} ${(drive.order as { vehicle_model: string }).vehicle_model ?? ''}`.trim()
                : null

              return (
                <div
                  key={drive.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {formatRoute(drive)}
                        </span>
                        <Badge variant="outline" className={`text-xs shrink-0 ${LOCAL_DRIVE_STATUS_COLORS[drive.status as LocalDriveStatus]}`}>
                          {LOCAL_DRIVE_STATUS_LABELS[drive.status as LocalDriveStatus]}
                        </Badge>
                      </div>
                      {orderInfo && (
                        <p className="text-xs text-muted-foreground">{orderInfo}</p>
                      )}
                    </div>
                    {drive.scheduled_date && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {drive.scheduled_date}
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 shrink-0"
                    onClick={() => handleAssign(drive.id)}
                    disabled={!!assigningId || assigningAll}
                  >
                    {isAssigning ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1 h-3.5 w-3.5" />
                    )}
                    Assign
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
