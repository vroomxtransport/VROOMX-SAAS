'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocalDrives } from '@/hooks/use-local-drives'
import { useQuery } from '@tanstack/react-query'
import { fetchDriverOptions } from '@/lib/queries/drivers'
import { LocalDriveCard } from './local-drive-card'
import { LocalDriveRow } from './local-drive-row'
import { LocalDriveDrawer } from './local-drive-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Navigation } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchLocalDrives } from '@/lib/queries/local-drives'
import { LOCAL_DRIVE_STATUS_LABELS } from '@/types'
import type { LocalDriveStatus } from '@/types'
import type { EnhancedFilterConfig } from '@/types/filters'
import type { SortConfig, DateRange } from '@/types/filters'
import type { LocalDrive } from '@/types/database'

const STATUS_PILL_COLORS: Record<LocalDriveStatus, string> = {
  pending: 'text-blue-800',
  in_progress: 'text-amber-800',
  completed: 'text-emerald-800',
  cancelled: 'text-red-800',
}

const CSV_HEADERS = [
  'status',
  'pickup_location',
  'pickup_city',
  'pickup_state',
  'delivery_location',
  'delivery_city',
  'delivery_state',
  'scheduled_date',
  'completed_date',
  'revenue',
  'driver',
  'truck',
  'order_number',
]

export function LocalDriveList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('local-drives')
  const setView = useViewStore((s) => s.setView)

  const [pageSize, setPageSize] = useState(25)

  // Lightweight driver fetch for filter dropdown only (id + name, no pagination)
  const supabase = createClient()
  const { data: driverOptionsRaw = [] } = useQuery({
    queryKey: ['driver-options'],
    queryFn: () => fetchDriverOptions(supabase),
    staleTime: 60_000,
  })

  // Build filter config with dynamic driver options
  const enhancedFilterConfig = useMemo((): EnhancedFilterConfig[] => {
    const driverOptions = driverOptionsRaw.map((d) => ({
      value: d.id,
      label: `${d.first_name} ${d.last_name}`,
    }))

    return [
      {
        key: 'status',
        label: 'Status',
        type: 'status-pills',
        options: (
          Object.entries(LOCAL_DRIVE_STATUS_LABELS) as [LocalDriveStatus, string][]
        ).map(([value, label]) => ({
          value,
          label,
          color: STATUS_PILL_COLORS[value],
        })),
      },
      {
        key: 'search',
        label: 'Search',
        type: 'search',
        placeholder: 'City, location...',
      },
      {
        key: 'driverId',
        label: 'Driver',
        type: 'select',
        options: driverOptions,
      },
      {
        key: 'dateRange',
        label: 'Date Range',
        type: 'date-range',
      },
    ]
  }, [driverOptionsRaw])

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | DateRange> = {}
    for (const filter of enhancedFilterConfig) {
      if (filter.type === 'date-range') {
        const from = searchParams.get('dateFrom')
        const to = searchParams.get('dateTo')
        if (from && to) {
          filters[filter.key] = { from, to }
        }
      } else {
        const value = searchParams.get(filter.key)
        if (value) {
          filters[filter.key] = value
        }
      }
    }
    return filters
  }, [searchParams, enhancedFilterConfig])

  // Parse sort from URL
  const currentSort = useMemo((): SortConfig | undefined => {
    const sortBy = searchParams.get('sortBy')
    const sortDir = searchParams.get('sortDir')
    if (sortBy && (sortDir === 'asc' || sortDir === 'desc')) {
      return { field: sortBy, direction: sortDir }
    }
    return undefined
  }, [searchParams])

  // Extract date range for query
  const dateRange = activeFilters.dateRange as DateRange | undefined

  const { data, isLoading } = useLocalDrives({
    status: activeFilters.status as string | undefined,
    search: activeFilters.search as string | undefined,
    driverId: activeFilters.driverId as string | undefined,
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    sortBy: currentSort?.field,
    sortDir: currentSort?.direction,
    page: currentPage,
    pageSize,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingDrive, setEditingDrive] = useState<LocalDrive | undefined>(undefined)

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
      } else if (value && typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
      }

      // Reset to first page on filter change
      params.delete('page')
      router.push(`/local-drives?${params.toString()}`)
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
      router.push(`/local-drives?${params.toString()}`)
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
      router.push(`/local-drives?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`/local-drives?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddDrive = () => {
    setEditingDrive(undefined)
    setDrawerOpen(true)
  }

  const handleEditDrive = (drive: LocalDrive) => {
    setEditingDrive(drive)
    setDrawerOpen(true)
  }

  const handleCardClick = (drive: LocalDrive) => {
    handleEditDrive(drive)
  }

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const supabase = createClient()
    const result = await fetchLocalDrives(supabase, {
      status: activeFilters.status as string | undefined,
      search: activeFilters.search as string | undefined,
      driverId: activeFilters.driverId as string | undefined,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
      sortBy: currentSort?.field,
      sortDir: currentSort?.direction,
      page: 0,
      pageSize: 10000,
    })
    return result.localDrives.map((ld) => ({
      status: ld.status,
      pickup_location: ld.pickup_location ?? '',
      pickup_city: ld.pickup_city ?? '',
      pickup_state: ld.pickup_state ?? '',
      delivery_location: ld.delivery_location ?? '',
      delivery_city: ld.delivery_city ?? '',
      delivery_state: ld.delivery_state ?? '',
      scheduled_date: ld.scheduled_date ?? '',
      completed_date: ld.completed_date ?? '',
      revenue: ld.revenue,
      driver: ld.driver ? `${ld.driver.first_name} ${ld.driver.last_name}` : '',
      truck: ld.truck?.unit_number ?? '',
      order_number: ld.order?.order_number ?? '',
    }))
  }, [activeFilters, dateRange, currentSort])

  if (isLoading) {
    return (
      <div>
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

  const localDrives = data?.localDrives ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={enhancedFilterConfig}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="local-drives"
            headers={CSV_HEADERS}
            fetchData={handleCsvExport}
          />
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('local-drives', mode)} />
          <Button onClick={handleAddDrive}>
            <Plus className="mr-2 h-4 w-4" />
            Add Local Drive
          </Button>
        </div>
      </div>

      {localDrives.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="No local drives yet"
          description="Create your first local drive to start managing short-distance transports."
          action={{
            label: 'Add Local Drive',
            onClick: handleAddDrive,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {localDrives.map((drive) => (
                <LocalDriveCard
                  key={drive.id}
                  localDrive={drive}
                  onClick={() => handleCardClick(drive)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditDrive(drive)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Sort headers for list view */}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <SortHeader
                    label="Route"
                    field="pickup_city"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="shrink-0 w-[100px]">
                  <SortHeader
                    label="Status"
                    field="status"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="hidden md:block shrink-0 w-[160px]">
                  <span className="text-xs font-medium text-muted-foreground">Order</span>
                </div>
                <div className="hidden md:block shrink-0 w-[140px]">
                  <span className="text-xs font-medium text-muted-foreground">Driver</span>
                </div>
                <div className="hidden lg:block shrink-0 w-[120px]">
                  <SortHeader
                    label="Date"
                    field="scheduled_date"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="hidden lg:block shrink-0 w-[80px]">
                  <SortHeader
                    label="Revenue"
                    field="revenue"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="shrink-0 w-[40px]">
                  <span className="text-xs font-medium text-muted-foreground sr-only">Actions</span>
                </div>
              </div>

              {localDrives.map((drive) => (
                <LocalDriveRow
                  key={drive.id}
                  localDrive={drive}
                  onClick={() => handleCardClick(drive)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditDrive(drive)
                  }}
                />
              ))}
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

      <LocalDriveDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        localDrive={editingDrive}
      />
    </div>
  )
}
