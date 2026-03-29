'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useTrips } from '@/hooks/use-trips'
import { TripRow } from './trip-row'
import { TripFilters } from './trip-filters'
import { NewTripDialog } from './new-trip-dialog'
import { ViewToggle } from './view-toggle'
import { DispatchSummary } from './dispatch-summary'
import { DispatchKanban } from './dispatch-kanban'
import { UnassignedOrdersPanel } from './unassigned-orders-panel'
import { TripDragOverlay, OrderDragOverlay } from './drag-overlays'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Truck, ChevronDown, ChevronRight } from 'lucide-react'
import { HelpTooltip } from '@/components/help-tooltip'
import { PageHeader } from '@/components/shared/page-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { TRIP_STATUSES, TRIP_STATUS_LABELS, TRUCK_CAPACITY } from '@/types'
import type { TripStatus, TruckType } from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import type { DateRange } from '@/types/filters'
import { updateTripStatus, assignOrderToTrip } from '@/app/actions/trips'
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
  planned: 'bg-blue-50/50',
  in_progress: 'bg-amber-50/50',
  at_terminal: 'bg-purple-50/50',
  completed: 'bg-green-50/50',
}

export function DispatchBoard() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    completed: true, // Completed starts collapsed
  })

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeDragType, setActiveDragType] = useState<'trip' | 'order' | null>(null)
  const [activeDragData, setActiveDragData] = useState<unknown>(null)
  const [, startTransition] = useTransition()

  // Sensors with activation constraints
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  // Parse URL search params for filters
  const search = searchParams.get('q') ?? undefined
  const status = searchParams.get('status') as TripStatus | undefined
  const driverId = searchParams.get('driver') ?? undefined
  const truckId = searchParams.get('truck') ?? undefined
  const startDate = searchParams.get('startDate') ?? ''
  const endDate = searchParams.get('endDate') ?? ''
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  // Reconstruct dateRange from URL params for the filter bar
  const dateRange: DateRange | undefined = useMemo(() => {
    if (startDate && endDate) return { from: startDate, to: endDate }
    return undefined
  }, [startDate, endDate])

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

  // Build activeFilters record for EnhancedFilterBar
  const activeFilters: Record<string, string | string[] | DateRange | undefined> = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.q = search
    if (status) filters.status = status
    if (driverId) filters.driver = driverId
    if (truckId) filters.truck = truckId
    if (dateRange) filters.dateRange = dateRange
    return filters
  }, [search, status, driverId, truckId, dateRange])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())

      if (key === 'dateRange') {
        // Extract from/to into separate URL params
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const dr = value as DateRange
          // Convert ISO string to date-only format for URL
          const fromDate = dr.from.slice(0, 10)
          const toDate = dr.to.slice(0, 10)
          params.set('startDate', fromDate)
          params.set('endDate', toDate)
        } else {
          params.delete('startDate')
          params.delete('endDate')
        }
      } else if (typeof value === 'string') {
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

  // CSV export data fetcher
  const fetchCsvData = useCallback(async (): Promise<Record<string, unknown>[]> => {
    if (!data?.trips) return []
    return data.trips.map((trip) => ({
      trip_number: trip.trip_number ?? '',
      status: TRIP_STATUS_LABELS[trip.status as TripStatus] ?? trip.status,
      driver: trip.driver ? `${trip.driver.first_name} ${trip.driver.last_name}` : '',
      truck: trip.truck?.unit_number ?? '',
      order_count: trip.order_count ?? 0,
      start_date: trip.start_date ?? '',
      end_date: trip.end_date ?? '',
      total_revenue: trip.total_revenue ?? '',
      driver_pay: trip.driver_pay ?? '',
      net_profit: trip.net_profit ?? '',
    }))
  }, [data?.trips])

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

  // ─── Drag Handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const type = active.data.current?.type as 'trip' | 'order' | undefined
    if (!type) return

    setActiveId(String(active.id))
    setActiveDragType(type)

    if (type === 'trip') {
      setActiveDragData(active.data.current?.trip)
    } else if (type === 'order') {
      setActiveDragData(active.data.current?.order)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    // Reset drag state
    setActiveId(null)
    setActiveDragType(null)
    setActiveDragData(null)

    if (!over) return

    const activeType = active.data.current?.type
    const overType = over.data.current?.type

    // Trip dropped on a column → change status
    if (activeType === 'trip' && overType === 'column') {
      const tripId = String(active.id)
      const newStatus = over.data.current?.status as TripStatus
      const trip = active.data.current?.trip as TripWithRelations

      // Don't do anything if same status
      if (trip.status === newStatus) return

      startTransition(async () => {
        const result = await updateTripStatus(tripId, newStatus)
        if (result.error) {
          toast.error('Failed to update trip status', { description: String(result.error) })
        } else {
          toast.success(`Trip moved to ${newStatus.replace('_', ' ')}`)
          queryClient.invalidateQueries({ queryKey: ['trips'] })
          queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
        }
      })
    }

    // Order dropped on a trip card → assign order to trip
    if (activeType === 'order' && overType === 'trip-card') {
      const orderId = String(active.id)
      const tripId = over.data.current?.tripId as string

      startTransition(async () => {
        const result = await assignOrderToTrip(orderId, tripId)
        if (result.error) {
          toast.error('Failed to assign order', { description: String(result.error) })
        } else {
          toast.success('Order assigned to trip')
          queryClient.invalidateQueries({ queryKey: ['trips'] })
          queryClient.invalidateQueries({ queryKey: ['unassigned-orders'] })
        }
      })
    }
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setActiveDragType(null)
    setActiveDragData(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Trips"
        subtitle={data ? `Showing ${data.trips.length} of ${data.total} trips` : 'Manage trips and dispatching.'}
      >
        <HelpTooltip
          content="Create trips, assign orders, and track driver progress. Drag trip cards between columns to change status. Drag orders onto trips to assign them."
          side="right"
        />
        <CsvExportButton
          filename="trips-export"
          headers={['trip_number', 'status', 'driver', 'truck', 'order_count', 'start_date', 'end_date', 'total_revenue', 'driver_pay', 'net_profit']}
          fetchData={fetchCsvData}
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
            onFilterChange={handleFilterChange}
            resultCount={data?.total}
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
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Board View (desktop only — hidden below lg) */}
          {viewMode === 'board' ? (
            <div>
              {/* Kanban — hidden on mobile/tablet, shown on lg+ */}
              <div className="hidden lg:block">
                <DispatchKanban
                  groupedTrips={groupedTrips}
                  isDraggingTrip={activeDragType === 'trip'}
                  isDraggingOrder={activeDragType === 'order'}
                  activeId={activeId}
                />
              </div>
              {/* On mobile/tablet, fall back to list view */}
              <div className="lg:hidden">
                <ListView
                  groupedTrips={groupedTrips}
                  collapsedSections={collapsedSections}
                  toggleSection={toggleSection}
                  isDraggingTrip={activeDragType === 'trip'}
                  isDraggingOrder={activeDragType === 'order'}
                  activeId={activeId}
                />
              </div>
            </div>
          ) : (
            /* List View */
            <ListView
              groupedTrips={groupedTrips}
              collapsedSections={collapsedSections}
              toggleSection={toggleSection}
              isDraggingTrip={activeDragType === 'trip'}
              isDraggingOrder={activeDragType === 'order'}
              activeId={activeId}
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
              <UnassignedOrdersPanel forceExpanded={activeDragType === 'order'} />
            </div>
          )}

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeId && activeDragType === 'trip' && activeDragData ? (
              <TripDragOverlay trip={activeDragData as TripWithRelations} />
            ) : null}
            {activeId && activeDragType === 'order' && activeDragData ? (
              <OrderDragOverlay order={activeDragData as import('@/hooks/use-unassigned-orders').UnassignedOrderWithBroker} />
            ) : null}
          </DragOverlay>
        </DndContext>
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

const LIST_DROP_HIGHLIGHT_COLORS: Record<TripStatus, string> = {
  planned: 'ring-blue-500/50 bg-blue-950/5',
  in_progress: 'ring-amber-500/50 bg-amber-950/5',
  at_terminal: 'ring-purple-500/50 bg-purple-950/5',
  completed: 'ring-green-500/50 bg-green-950/5',
}

interface ListViewProps {
  groupedTrips: Record<TripStatus, TripWithRelations[]>
  collapsedSections: Record<string, boolean>
  toggleSection: (status: string) => void
  isDraggingTrip?: boolean
  isDraggingOrder?: boolean
  activeId?: string | null
}

function ListView({ groupedTrips, collapsedSections, toggleSection, isDraggingTrip, isDraggingOrder, activeId }: ListViewProps) {
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
        {TRIP_STATUSES.map((sectionStatus) => (
          <ListSection
            key={sectionStatus}
            status={sectionStatus}
            trips={groupedTrips[sectionStatus]}
            isCollapsed={!!collapsedSections[sectionStatus]}
            onToggle={() => toggleSection(sectionStatus)}
            isDraggingTrip={isDraggingTrip}
            isDraggingOrder={isDraggingOrder}
            activeId={activeId}
          />
        ))}
      </div>
    </>
  )
}

interface ListSectionProps {
  status: TripStatus
  trips: TripWithRelations[]
  isCollapsed: boolean
  onToggle: () => void
  isDraggingTrip?: boolean
  isDraggingOrder?: boolean
  activeId?: string | null
}

function ListSection({ status, trips, isCollapsed, onToggle, isDraggingTrip, isDraggingOrder, activeId }: ListSectionProps) {
  const count = trips.length

  // Droppable: receive trips being dragged to change status
  const { setNodeRef, isOver } = useDroppable({
    id: `list-column-${status}`,
    data: { type: 'column', status },
    disabled: !isDraggingTrip,
  })

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 transition-all duration-150',
        SECTION_BORDER_COLORS[status],
        isDraggingTrip && 'ring-1 ring-dashed ring-muted-foreground/20',
        isOver && isDraggingTrip && `ring-2 ${LIST_DROP_HIGHLIGHT_COLORS[status]}`,
      )}
    >
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-t-lg px-4 py-2.5 text-left transition-colors hover:bg-accent/50',
          SECTION_BG_COLORS[status]
        )}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {TRIP_STATUS_LABELS[status]}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {count}
          </span>
        </div>
      </button>

      {/* Section content — droppable zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[40px] transition-all duration-150',
          !isCollapsed && 'space-y-1 p-2',
        )}
      >
        {isOver && isDraggingTrip && (
          <div className="flex items-center justify-center py-2">
            <span className="text-xs font-medium text-muted-foreground animate-pulse">
              Drop to move here
            </span>
          </div>
        )}
        {!isCollapsed && (
          count === 0 && !isOver ? (
            <p className="px-4 py-3 text-sm italic text-muted-foreground">
              No trips
            </p>
          ) : (
            trips.map((trip) => (
              <TripRow
                key={trip.id}
                trip={trip}
                isDraggingOrder={isDraggingOrder}
                activeId={activeId}
              />
            ))
          )
        )}
      </div>
    </div>
  )
}
