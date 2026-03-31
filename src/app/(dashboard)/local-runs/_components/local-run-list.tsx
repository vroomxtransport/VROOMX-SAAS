'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocalRuns } from '@/hooks/use-local-runs'
import { useTerminals } from '@/hooks/use-terminals'
import { deleteLocalRun, updateLocalRunStatus } from '@/app/actions/local-runs'
import { LocalRunForm } from './local-run-form'
import { LocalRunDetail } from './local-run-detail'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Route, Pencil, Trash2, Play, CheckCircle2, Navigation } from 'lucide-react'
import {
  LOCAL_RUN_STATUS_LABELS,
  LOCAL_RUN_STATUS_COLORS,
  LOCAL_DRIVE_TYPE_LABELS,
  LOCAL_DRIVE_TYPE_COLORS,
} from '@/types'
import type { LocalRunStatus, LocalDriveType } from '@/types'
import type { LocalRun } from '@/types/database'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

export function LocalRunList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''
  const typeFilter = searchParams.get('type') ?? ''
  const terminalFilter = searchParams.get('terminalId') ?? ''

  const { data, isLoading } = useLocalRuns({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    terminalId: terminalFilter || undefined,
    page: 0,
    pageSize: PAGE_SIZE,
  })

  const { data: terminals } = useTerminals({ activeOnly: true })

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRun, setEditingRun] = useState<LocalRun | undefined>(undefined)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/local-runs?${params.toString()}`)
  }, [searchParams, router])

  const handleAdd = () => {
    setEditingRun(undefined)
    setFormOpen(true)
  }

  const handleEdit = (run: LocalRun) => {
    setEditingRun(run)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteLocalRun(deleteId)
    if (selectedRunId === deleteId) setSelectedRunId(null)
    setDeleteId(null)
  }

  const handleStatusChange = async (id: string, status: LocalRunStatus) => {
    await updateLocalRunStatus(id, status)
  }

  const handleFormSuccess = () => {
    setFormOpen(false)
    setEditingRun(undefined)
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <div className="w-80 shrink-0 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="flex-1 rounded-lg" />
      </div>
    )
  }

  const localRuns = data?.localRuns ?? []

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setFilter('status', v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(Object.entries(LOCAL_RUN_STATUS_LABELS) as [LocalRunStatus, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setFilter('type', v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.entries(LOCAL_DRIVE_TYPE_LABELS) as [LocalDriveType, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {terminals && terminals.length > 0 && (
            <Select value={terminalFilter} onValueChange={(v) => setFilter('terminalId', v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Terminals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terminals</SelectItem>
                {terminals.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          New Run
        </Button>
      </div>

      {localRuns.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No local runs yet"
          description="Create a local run to group local drives into a batched operation."
          action={{ label: 'New Run', onClick: handleAdd }}
        />
      ) : (
        /* Split view: list (left) + detail (right) */
        <div className="flex gap-4 h-[calc(100vh-14rem)]">
          {/* Left: runs list */}
          <div className="w-80 shrink-0 overflow-y-auto space-y-1.5 pr-1">
            {localRuns.map((run) => {
              const isSelected = selectedRunId === run.id
              const driverName = run.driver
                ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}`
                : 'Unassigned'
              const terminalName = (run.terminal as { name: string } | null)?.name ?? 'No terminal'
              const driveCount = (run.local_drives as Array<unknown> | undefined)?.length ?? 0

              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={cn(
                    'rounded-lg border p-3 cursor-pointer transition-all',
                    isSelected
                      ? 'border-brand bg-brand/5 shadow-sm'
                      : 'border-border-subtle bg-surface hover:bg-accent/30'
                  )}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm truncate">{terminalName}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${LOCAL_DRIVE_TYPE_COLORS[run.type as LocalDriveType]}`}>
                      {LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType]}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{driverName}</span>
                      <span>·</span>
                      <span>{driveCount} drive{driveCount !== 1 ? 's' : ''}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus]}`}>
                      {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus]}
                    </Badge>
                  </div>
                  {(run.scheduled_date || parseFloat(run.total_expense) > 0) && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {run.scheduled_date && <span>{run.scheduled_date}</span>}
                      {parseFloat(run.total_expense) > 0 && (
                        <span className="font-medium text-foreground">${parseFloat(run.total_expense).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: detail panel */}
          <div className="flex-1 overflow-y-auto rounded-lg border bg-surface">
            {selectedRunId ? (
              <div className="p-5">
                <LocalRunDetail
                  runId={selectedRunId}
                  onEdit={(run) => handleEdit(run)}
                  onDelete={(id) => setDeleteId(id)}
                  onStatusChange={handleStatusChange}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Navigation className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Select a run from the list to view details and manage drives</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit form sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>{editingRun ? 'Edit Local Run' : 'New Local Run'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <LocalRunForm localRun={editingRun} onSuccess={handleFormSuccess} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Delete Local Run"
        description="This will delete the run and unassign all its drives. The drives will remain as pending. Continue?"
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
