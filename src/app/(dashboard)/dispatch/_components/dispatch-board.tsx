'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTrips } from '@/hooks/use-trips'
import { TripRow } from './trip-row'
import { TripFilters } from './trip-filters'
import { NewTripDialog } from './new-trip-dialog'
import { ViewToggle } from './view-toggle'
import { DispatchSummary } from './dispatch-summary'
import { DispatchKanban } from './dispatch-kanban'
import { UnassignedOrdersPanel } from './unassigned-orders-panel'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Truck, ChevronDown, ChevronRight } from 'lucide-react'
import { HelpTooltip } from '@/components/help-tooltip'
import { PageHeader } from '@/components/shared/page-header'
import { TRIP_STATUSES, TRIP_STATUS_LABELS, TRIP_STATUS_COLORS, TRUCK_CAPACITY } from '@/types'
import type { TripStatus, TruckType } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

// Section accent colors (left border) — used by list view
const SECTION_BORDER_COLORS: Record<TripStatus, string> = {
  planned: 'border-l-blue-500',
  in_progress: 'border-l-amber-500',
  at_terminal: 'border-l-purple-500',
  completed: 'border-l-green-500',
}

const SECTION_BG_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-50/50 dark:bg-blue-950/20',
  in_progress: 'bg-amber-50/50 dark:bg-amber-950/20',
  at_terminal: 'bg-purple-50/50 dark:bg-purple-950/20',
  completed: 'bg-green-50/50 dark:bg-green-950/20',
}

export function DispatchBoard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    completed: true, // Completed starts collapsed
  })

  // Parse URL search params for filters
  const search = searchParams.get('q') ?? undefined
  const status = searchParams.get('status') as TripStatus | undefined
  const driverId = searchParams.get('driver') ?? undefined
  const truckId = searchParams.get('truck') ?? undefined
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const { data, isPending, isError, error } = useTrips({
    search,
    status: status || undefined,
    driverId,
    truckId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const activeFilters: Record<string, string> = {}
  if (search) activeFilters.q = search
  if (status) activeFilters.status = status
  if (driverId) activeFilters.driver = driverId
  if (truckId) activeFilters.truck = truckId

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
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

  const handleDateChange = useCallback(
    (key: 'startDate' | 'endDate', value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const toggleSection = useCallback((sectionStatus: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionStatus]: !prev[sectionStatus],
    }))
  }, [])

  // Group trips by status
  const groupedTrips = useMemo(() => {
    if (!data?.trips) return null

    const groups: Record<TripStatus, TripWithRelations[]> = {
      planned: [],
      in_progress: [],
      at_terminal: [],
      completed: [],
    }

    for (const trip of data.trips) {
      const tripStatus = trip.status as TripStatus
      if (groups[tripStatus]) {
        groups[tripStatus].push(trip)
      }
    }

    return groups
  }, [data?.trips])

  // Compute summary stats
  const summaryStats = useMemo(() => {
    if (!groupedTrips) return { planned: 0, inProgress: 0, capacity: { used: 0, total: 0 } }

    const planned = groupedTrips.planned.length
    const inProgress = groupedTrips.in_progress.length + groupedTrips.at_terminal.length

    // Calculate total capacity from active (non-completed) trips
    let totalCapacity = 0
    let usedCapacity = 0
    const activeStatuses: TripStatus[] = ['planned', 'in_progress', 'at_terminal']
    for (const s of activeStatuses) {
      for (const trip of groupedTrips[s]) {
        const truckType = trip.truck?.truck_type as TruckType | undefined
        const maxCap = truckType ? TRUCK_CAPACITY[truckType] : 0
        totalCapacity += maxCap
        usedCapacity += trip.order_count ?? 0
      }
    }

    return { planned, inProgress, capacity: { used: usedCapacity, total: totalCapacity } }
  }, [groupedTrips])

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Dispatch Board"
        subtitle={data ? `Showing ${data.trips.length} of ${data.total} trips` : 'Manage trips and dispatching.'}
      >
        <HelpTooltip
          content="Create trips, assign orders, and track driver progress. Trips flow from Planned to In Progress to Completed."
          side="right"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Trip
        </Button>
      </PageHeader>

      {/* Summary Strip */}
      {groupedTrips && (
        <DispatchSummary
          planned={summaryStats.planned}
          inProgress={summaryStats.inProgress}
          capacity={summaryStats.capacity}
        />
      )}

      {/* Filters + View Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <TripFilters
            activeFilters={activeFilters}
            onFilterChange={setFilter}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(v) => handleDateChange('startDate', v)}
            onEndDateChange={(v) => handleDateChange('endDate', v)}
          />
        </div>
        {/* Hide view toggle on mobile/tablet — force list view */}
        <div className="hidden lg:block shrink-0 pt-0.5">
          <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

      {/* Content */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load trips: {error?.message ?? 'Unknown error'}
        </div>
      ) : data && data.trips.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No trips yet"
          description="Create your first trip to get started with dispatching."
          action={{
            label: 'New Trip',
            onClick: () => setDialogOpen(true),
          }}
        />
      ) : groupedTrips ? (
        <>
          {/* Board View (desktop only — hidden below lg) */}
          {viewMode === 'board' ? (
            <div>
              {/* Kanban — hidden on mobile/tablet, shown on lg+ */}
              <div className="hidden lg:block">
                <DispatchKanban groupedTrips={groupedTrips} />
              </div>
              {/* On mobile/tablet, fall back to list view */}
              <div className="lg:hidden">
                <ListView
                  groupedTrips={groupedTrips}
                  collapsedSections={collapsedSections}
                  toggleSection={toggleSection}
                />
              </div>
            </div>
          ) : (
            /* List View */
            <ListView
              groupedTrips={groupedTrips}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
            />
          )}

          {/* Pagination */}
          {data && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
            />
          )}

          {/* Unassigned Orders Panel (board view on desktop) */}
          {viewMode === 'board' && (
            <div className="hidden lg:block">
              <UnassignedOrdersPanel />
            </div>
          )}
        </>
      ) : null}

      {/* New Trip Dialog */}
      <NewTripDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}

// ─── List View (extracted) ──────────────────────────────────────────────────

interface ListViewProps {
  groupedTrips: Record<TripStatus, TripWithRelations[]>
  collapsedSections: Record<string, boolean>
  toggleSection: (status: string) => void
}

function ListView({ groupedTrips, collapsedSections, toggleSection }: ListViewProps) {
  return (
    <>
      {/* Column header row */}
      <div className="hidden items-center gap-4 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:flex">
        <div className="w-28 shrink-0">Trip #</div>
        <div className="w-20 shrink-0">Truck</div>
        <div className="w-24 shrink-0">Driver</div>
        <div className="w-14 shrink-0">Cap</div>
        <div className="min-w-0 flex-1">Route</div>
        <div className="w-28 shrink-0">Status</div>
        <div className="w-32 shrink-0 text-right">Dates</div>
      </div>

      {/* Status-grouped sections */}
      <div className="space-y-4">
        {TRIP_STATUSES.map((sectionStatus) => {
          const trips = groupedTrips[sectionStatus]
          const isCollapsed = !!collapsedSections[sectionStatus]
          const count = trips.length

          return (
            <div
              key={sectionStatus}
              className={cn(
                'rounded-lg border-l-4',
                SECTION_BORDER_COLORS[sectionStatus]
              )}
            >
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(sectionStatus)}
                className={cn(
                  'flex w-full items-center justify-between rounded-t-lg px-4 py-2.5 text-left transition-colors hover:bg-accent/50',
                  SECTION_BG_COLORS[sectionStatus]
                )}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {TRIP_STATUS_LABELS[sectionStatus]}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {count}
                  </span>
                </div>
              </button>

              {/* Section content */}
              {!isCollapsed && (
                <div className="space-y-1 p-2">
                  {count === 0 ? (
                    <p className="px-4 py-3 text-sm italic text-muted-foreground">
                      No trips
                    </p>
                  ) : (
                    trips.map((trip) => (
                      <TripRow key={trip.id} trip={trip} />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
