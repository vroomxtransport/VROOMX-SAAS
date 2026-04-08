'use client'

import { useCallback, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useApplications } from '@/hooks/use-applications'
import { StatusBadge } from '@/components/shared/status-badge'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { SortHeader } from '@/components/shared/sort-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserAdd01Icon } from '@hugeicons/core-free-icons'
import { ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'
import type { DriverApplication } from '@/types/database'
import { DRIVER_APPLICATION_STATUSES, DRIVER_APPLICATION_STATUS_LABELS } from '@/types'

// ── Filter config ──────────────────────────────────────────────────────────────

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: DRIVER_APPLICATION_STATUSES.map((s) => ({
      value: s,
      label: DRIVER_APPLICATION_STATUS_LABELS[s],
    })),
  },
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Name or email...',
  },
]

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_130px_90px_120px_130px_70px] gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        {['Applicant', 'Status', 'Submitted', 'Progress', 'Assignee', 'Last Activity', ''].map((h) => (
          <span key={h} className="text-xs font-medium text-muted-foreground">{h}</span>
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_120px_130px_90px_120px_130px_70px] gap-2 items-center border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-14 ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ── Progress helper ───────────────────────────────────────────────────────────

function computeProgress(_app: DriverApplication): string {
  // Pipeline steps are not available in the list view.
  // Full progress (X/10) is shown in the detail page after the pipeline is loaded.
  return '—'
}

// ── Main component ────────────────────────────────────────────────────────────

export function ApplicationsList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const status = searchParams.get('status') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const sortBy = searchParams.get('sortBy') ?? 'submitted_at'
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') ?? 'desc'
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const [pageSize, setPageSize] = useState(25)

  const sort: SortConfig = { field: sortBy, direction: sortDir }

  const { data, isLoading, error } = useApplications({
    status,
    search,
    page,
    pageSize,
  })

  // ── URL helpers ──────────────────────────────────────────────────────────────

  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleSort = useCallback(
    (newSort: SortConfig | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newSort) {
        params.set('sortBy', newSort.field)
        params.set('sortDir', newSort.direction)
      } else {
        params.delete('sortBy')
        params.delete('sortDir')
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(newPage))
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  // ── Active filter map for EnhancedFilterBar ───────────────────────────────

  const activeFilters: Record<string, string | string[] | DateRange | undefined> = {}
  if (status) activeFilters.status = status
  if (search) activeFilters.search = search

  const applications = data?.applications ?? []
  const total = data?.total ?? 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <EnhancedFilterBar
        filters={FILTER_CONFIG}
        activeFilters={activeFilters}
        onFilterChange={setFilter}
        resultCount={data ? total : undefined}
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error instanceof Error ? error.message : 'Failed to load applications'}
        </div>
      ) : applications.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-border bg-surface">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={UserAdd01Icon} size={24} className="text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-foreground">No applications yet</p>
          <p className="mt-1 text-center text-xs text-muted-foreground max-w-[280px]">
            Drivers can apply using your public application link. Share it to start receiving applications.
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_120px_130px_90px_120px_130px_70px] gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <SortHeader label="Applicant" field="last_name" currentSort={sort} onSort={handleSort} />
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <SortHeader label="Submitted" field="submitted_at" currentSort={sort} onSort={handleSort} />
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-xs font-medium text-muted-foreground">Assignee</span>
              <span className="text-xs font-medium text-muted-foreground">Last Activity</span>
              <span className="sr-only">Actions</span>
            </div>

            {/* Rows */}
            {applications.map((app) => (
              <ApplicationRow
                key={app.id}
                app={app}
                onView={() => router.push(`/onboarding/${app.id}`)}
              />
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}
    </div>
  )
}

// ── Row subcomponent ──────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  onView,
}: {
  app: DriverApplication
  onView: () => void
}) {
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Unknown Applicant'

  const submittedLabel = app.submitted_at
    ? new Date(app.submitted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not yet'

  const lastActivity = app.updated_at
    ? formatDistanceToNow(new Date(app.updated_at), { addSuffix: true })
    : '—'

  return (
    <div className="grid grid-cols-[1fr_120px_130px_90px_120px_130px_70px] gap-2 items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/30 transition-colors">
      {/* Name + email */}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        {app.email && (
          <p className="truncate text-xs text-muted-foreground">{app.email}</p>
        )}
      </div>

      {/* Status */}
      <div>
        <StatusBadge type="application" status={app.status} />
      </div>

      {/* Submitted date */}
      <div className="text-sm text-muted-foreground">{submittedLabel}</div>

      {/* Pipeline progress — placeholder until pipeline data is in list query */}
      <div className="text-sm text-muted-foreground tabular-nums">
        {computeProgress(app)}
      </div>

      {/* Assignee — not available in list query; show placeholder */}
      <div className="text-sm text-muted-foreground">
        <span className="text-muted-foreground/60 italic text-xs">Unassigned</span>
      </div>

      {/* Last activity */}
      <div className="text-xs text-muted-foreground">{lastActivity}</div>

      {/* View */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onView}
        >
          View
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
