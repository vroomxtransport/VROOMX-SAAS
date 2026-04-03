'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMaintenanceRecords } from '@/hooks/use-maintenance'
import { useMaintenanceCounts } from '@/hooks/use-maintenance'
import { MaintenanceStats } from './maintenance-stats'
import { MaintenanceCard } from './maintenance-card'
import { MaintenanceRow } from './maintenance-row'
import { MaintenanceDrawer } from './maintenance-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'
import { useTrucks } from '@/hooks/use-trucks'
import { createClient } from '@/lib/supabase/client'
import { fetchMaintenanceRecords } from '@/lib/queries/maintenance'
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '@/types'
import type { EnhancedFilterConfig, FilterOption, DateRange, SortConfig } from '@/types/filters'
import type { MaintenanceRecord } from '@/types/database'
import type { MaintenanceType, MaintenanceStatus } from '@/types'

// Status pill color mapping (active state)
const STATUS_PILL_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function MaintenanceList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('maintenance')
  const setView = useViewStore((s) => s.setView)

  const [pageSize, setPageSize] = useState(25)

  // Load trucks for filter dropdown
  const { data: trucksData } = useTrucks({ pageSize: 200 })
  const truckOptions = useMemo(
    () =>
      (trucksData?.trucks ?? []).map((t) => ({
        value: t.id,
        label: t.unit_number,
      })),
    [trucksData?.trucks]
  )

  // Load counts for status pill badges
  const { data: counts } = useMaintenanceCounts()

  // Build status pill options with counts
  const statusPillOptions: FilterOption[] = useMemo(
    () => [
      {
        value: 'scheduled',
        label: 'Scheduled',
        color: STATUS_PILL_COLORS.scheduled,
        count: counts?.scheduled,
      },
      {
        value: 'in_progress',
        label: 'In Progress',
        color: STATUS_PILL_COLORS.in_progress,
        count: counts?.in_progress,
      },
      {
        value: 'completed',
        label: 'Completed',
        color: STATUS_PILL_COLORS.completed,
        count: counts?.completed,
      },
    ],
    [counts]
  )

  const FILTER_CONFIG: EnhancedFilterConfig[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        type: 'status-pills' as const,
        options: statusPillOptions,
      },
      {
        key: 'search',
        label: 'Search',
        type: 'search' as const,
        placeholder: 'Search maintenance...',
      },
      {
        key: 'truckId',
        label: 'Truck',
        type: 'select' as const,
        options: truckOptions,
      },
      {
        key: 'maintenanceType',
        label: 'Type',
        type: 'select' as const,
        options: Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'date-range' as const,
      },
    ],
    [truckOptions, statusPillOptions]
  )

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const activeFilters: Record<string, string | string[] | DateRange | undefined> = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}

    // Simple string filters
    for (const key of ['search', 'truckId', 'maintenanceType', 'status']) {
      const value = searchParams.get(key)
      if (value) filters[key] = value
    }

    // Date range from URL
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom && dateTo) {
      filters.dateRange = { from: dateFrom, to: dateTo }
    }

    return filters
  }, [searchParams])

  // Sort state from URL
  const currentSort: SortConfig | undefined = useMemo(() => {
    const sortBy = searchParams.get('sortBy')
    const sortDir = searchParams.get('sortDir') as 'asc' | 'desc' | null
    if (sortBy && sortDir) return { field: sortBy, direction: sortDir }
    return undefined
  }, [searchParams])

  // Extract date range for query
  const dateRange = activeFilters.dateRange as DateRange | undefined

  const { data, isLoading } = useMaintenanceRecords({
    truckId: activeFilters.truckId as string | undefined,
    maintenanceType: activeFilters.maintenanceType as string | undefined,
    status: activeFilters.status as string | undefined,
    search: activeFilters.search as string | undefined,
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    sortBy: currentSort?.field,
    sortDir: currentSort?.direction,
    page: currentPage,
    pageSize,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())

      if (key === 'dateRange') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const dr = value as DateRange
          params.set('dateFrom', dr.from)
          params.set('dateTo', dr.to)
        } else {
          params.delete('dateFrom')
          params.delete('dateTo')
        }
      } else if (typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
        // Also clear date params if clearing all
        if (key === 'dateRange') {
          params.delete('dateFrom')
          params.delete('dateTo')
        }
      }

      params.delete('page')
      router.push(`/maintenance?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleSortChange = useCallback(
    (sort: SortConfig | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (sort) {
        params.set('sortBy', sort.field)
        params.set('sortDir', sort.direction)
      } else {
        params.delete('sortBy')
        params.delete('sortDir')
      }
      params.delete('page')
      router.push(`/maintenance?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page === 0) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      router.push(`/maintenance?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`/maintenance?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddRecord = () => {
    setEditingRecord(undefined)
    setDrawerOpen(true)
  }

  const handleEditRecord = (record: MaintenanceRecord) => {
    setEditingRecord(record)
    setDrawerOpen(true)
  }

  const handleCardClick = (record: MaintenanceRecord) => {
    handleEditRecord(record)
  }

  // CSV export: fetch all matching records (no pagination)
  const handleCsvExport = useCallback(async () => {
    const supabase = createClient()
    const result = await fetchMaintenanceRecords(supabase, {
      truckId: activeFilters.truckId as string | undefined,
      maintenanceType: activeFilters.maintenanceType as string | undefined,
      status: activeFilters.status as string | undefined,
      search: activeFilters.search as string | undefined,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
      sortBy: currentSort?.field,
      sortDir: currentSort?.direction,
      page: 0,
      pageSize: 5000,
    })

    return result.records.map((r) => ({
      Truck: r.truck?.unit_number ?? 'Unassigned',
      Type: MAINTENANCE_TYPE_LABELS[r.maintenance_type as MaintenanceType] ?? r.maintenance_type,
      Status: MAINTENANCE_STATUS_LABELS[r.status as MaintenanceStatus] ?? r.status,
      Description: r.description ?? '',
      Vendor: r.vendor ?? '',
      Cost: r.cost ? parseFloat(r.cost).toFixed(2) : '0.00',
      'Scheduled Date': r.scheduled_date
        ? new Date(r.scheduled_date).toLocaleDateString()
        : '',
      'Completed Date': r.completed_date
        ? new Date(r.completed_date).toLocaleDateString()
        : '',
      Odometer: r.odometer ?? '',
      Notes: r.notes ?? '',
    }))
  }, [activeFilters, dateRange, currentSort])

  if (isLoading) {
    return (
      <div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] rounded-lg" />
            ))}
          </div>
        )}
      </div>
    )
  }

  const records = data?.records ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4">
        <MaintenanceStats />
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="maintenance-records"
            headers={[
              'Truck',
              'Type',
              'Status',
              'Description',
              'Vendor',
              'Cost',
              'Scheduled Date',
              'Completed Date',
              'Odometer',
              'Notes',
            ]}
            fetchData={handleCsvExport}
          />
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('maintenance', mode)} />
          <Button onClick={handleAddRecord}>
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance records"
          description="Add your first maintenance record to start tracking vehicle upkeep."
          action={{
            label: 'Add Record',
            onClick: handleAddRecord,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {records.map((record) => (
                <MaintenanceCard
                  key={record.id}
                  record={record}
                  onClick={() => handleCardClick(record)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditRecord(record)
                  }}
                />
              ))}
            </div>
          ) : (
            <div>
              {/* Sort headers for list view */}
              <div className="mb-2 flex items-center gap-3 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-muted-foreground">Truck</span>
                </div>
                <div className="hidden md:flex items-center gap-3 shrink-0 w-[200px]">
                  <SortHeader
                    label="Scheduled Date"
                    field="scheduled_date"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="hidden lg:flex items-center shrink-0 w-[100px]">
                  <SortHeader
                    label="Cost"
                    field="cost"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="shrink-0 w-[32px]" />
              </div>

              <div className="space-y-2">
                {records.map((record) => (
                  <MaintenanceRow
                    key={record.id}
                    record={record}
                    onClick={() => handleCardClick(record)}
                    onEdit={(e) => {
                      e.stopPropagation()
                      handleEditRecord(record)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={total}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </>
      )}

      <MaintenanceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        record={editingRecord}
      />
    </div>
  )
}
