'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocalRuns } from '@/hooks/use-local-runs'
import { useTerminals } from '@/hooks/use-terminals'
import { deleteLocalRun, updateLocalRunStatus } from '@/app/actions/local-runs'
import { LocalRunForm } from './local-run-form'
import { LocalRunDetail } from './local-run-detail'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/shared/pagination'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Route, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  LOCAL_RUN_STATUS_LABELS,
  LOCAL_RUN_STATUS_COLORS,
  LOCAL_DRIVE_TYPE_LABELS,
  LOCAL_DRIVE_TYPE_COLORS,
} from '@/types'
import type { LocalRunStatus, LocalDriveType } from '@/types'
import type { LocalRun } from '@/types/database'

const PAGE_SIZE = 20

export function LocalRunList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const statusFilter = searchParams.get('status') ?? ''
  const typeFilter = searchParams.get('type') ?? ''
  const terminalFilter = searchParams.get('terminalId') ?? ''

  const { data, isLoading } = useLocalRuns({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    terminalId: terminalFilter || undefined,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  const { data: terminals } = useTerminals({ activeOnly: true })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRun, setEditingRun] = useState<LocalRun | undefined>(undefined)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`/local-runs?${params.toString()}`)
  }, [searchParams, router])

  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 0) params.delete('page')
    else params.set('page', String(page))
    router.push(`/local-runs?${params.toString()}`)
  }, [searchParams, router])

  const handleAdd = () => {
    setEditingRun(undefined)
    setDrawerOpen(true)
  }

  const handleRowClick = (run: LocalRun) => {
    setSelectedRunId(run.id)
    setDetailOpen(true)
  }

  const handleEdit = (run: LocalRun) => {
    setEditingRun(run)
    setDrawerOpen(true)
  }

  const handleStatusChange = async (id: string, status: LocalRunStatus) => {
    await updateLocalRunStatus(id, status)
  }

  const handleDelete = async (id: string) => {
    await deleteLocalRun(id)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-lg" />
        ))}
      </div>
    )
  }

  const localRuns = data?.localRuns ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setFilter('status', v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[160px]">
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
          New Local Run
        </Button>
      </div>

      {localRuns.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No local runs yet"
          description="Create a local run to group local drives into a batched operation."
          action={{ label: 'New Local Run', onClick: handleAdd }}
        />
      ) : (
        <>
          <div className="space-y-2">
            {localRuns.map((run) => {
              const driverName = run.driver ? `${(run.driver as { first_name: string }).first_name} ${(run.driver as { last_name: string }).last_name}` : 'Unassigned'
              const terminalName = (run.terminal as { name: string } | null)?.name ?? 'No terminal'
              const truckUnit = (run.truck as { unit_number: string } | null)?.unit_number

              return (
                <div key={run.id} className="widget-card flex items-center gap-4 !p-3 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => handleRowClick(run)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{terminalName}</span>
                      <Badge variant="outline" className={`text-xs ${LOCAL_DRIVE_TYPE_COLORS[run.type as LocalDriveType]}`}>
                        {LOCAL_DRIVE_TYPE_LABELS[run.type as LocalDriveType]}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${LOCAL_RUN_STATUS_COLORS[run.status as LocalRunStatus]}`}>
                        {LOCAL_RUN_STATUS_LABELS[run.status as LocalRunStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{driverName}</span>
                      {truckUnit && <span>Truck #{truckUnit}</span>}
                      {run.scheduled_date && <span>{run.scheduled_date}</span>}
                      {parseFloat(run.total_expense) > 0 && <span className="font-medium">${parseFloat(run.total_expense).toLocaleString()}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(run) }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      {run.status === 'planned' && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(run.id, 'in_progress') }}>
                          Start Run
                        </DropdownMenuItem>
                      )}
                      {run.status === 'in_progress' && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(run.id, 'completed') }}>
                          Complete Run
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(run.id) }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>

          <div className="mt-6">
            <Pagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>{editingRun ? 'Edit Local Run' : 'New Local Run'}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <LocalRunForm
              localRun={editingRun}
              onSuccess={() => { setDrawerOpen(false); setEditingRun(undefined) }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-6">
          <SheetHeader>
            <SheetTitle>Local Run Details</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {selectedRunId && <LocalRunDetail runId={selectedRunId} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
