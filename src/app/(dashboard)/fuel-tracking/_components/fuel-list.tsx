'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useFuelEntries } from '@/hooks/use-fuel'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { FuelStats } from './fuel-stats'
import { FuelCard } from './fuel-card'
import { FuelRow } from './fuel-row'
import { FuelDrawer } from './fuel-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Fuel, Upload } from 'lucide-react'
import { FuelCsvImportDialog } from './fuel-csv-import-dialog'
import { createClient } from '@/lib/supabase/client'
import { fetchFuelEntries } from '@/lib/queries/fuel'
import type { FuelEntry } from '@/types/database'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'

const CSV_HEADERS = [
  'date',
  'truck',
  'driver',
  'gallons',
  'cost_per_gallon',
  'total_cost',
  'location',
  'state',
  'odometer',
  'notes',
]

export function FuelList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('fuel')
  const setView = useViewStore((s) => s.setView)

  const [pageSize, setPageSize] = useState(25)

  // Fetch trucks and drivers for filter selects
  const { data: trucksData } = useTrucks({ pageSize: 100 })
  const { data: driversData } = useDrivers({ pageSize: 100 })

  const truckOptions = useMemo(
    () =>
      (trucksData?.trucks ?? []).map((t) => ({
        value: t.id,
        label: t.unit_number,
      })),
    [trucksData]
  )

  const driverOptions = useMemo(
    () =>
      (driversData?.drivers ?? []).map((d) => ({
        value: d.id,
        label: `${d.first_name} ${d.last_name}`,
      })),
    [driversData]
  )

  const FILTER_CONFIG: EnhancedFilterConfig[] = useMemo(
    () => [
      {
        key: 'search',
        label: 'Search',
        type: 'search',
        placeholder: 'Location, state, notes...',
      },
      {
        key: 'truckId',
        label: 'Truck',
        type: 'select',
        options: truckOptions,
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
    ],
    [truckOptions, driverOptions]
  )

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | DateRange | undefined> = {}
    for (const filter of FILTER_CONFIG) {
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
  }, [searchParams, FILTER_CONFIG])

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

  const { data, isLoading } = useFuelEntries({
    truckId: activeFilters.truckId as string | undefined,
    driverId: activeFilters.driverId as string | undefined,
    search: activeFilters.search as string | undefined,
    dateFrom: dateRange?.from ? dateRange.from.slice(0, 10) : undefined,
    dateTo: dateRange?.to ? dateRange.to.slice(0, 10) : undefined,
    sortBy: currentSort?.field,
    sortDir: currentSort?.direction,
    page: currentPage,
    pageSize,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FuelEntry | undefined>(undefined)

  // CSV import dialog state
  const [importOpen, setImportOpen] = useState(false)

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())

      if (key === 'dateRange') {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const dr = value as DateRange
          params.set('dateFrom', dr.from.slice(0, 10))
          params.set('dateTo', dr.to.slice(0, 10))
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
      router.push(`/fuel-tracking?${params.toString()}`)
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
      router.push(`/fuel-tracking?${params.toString()}`)
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
      router.push(`/fuel-tracking?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`/fuel-tracking?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddEntry = () => {
    setEditingEntry(undefined)
    setDrawerOpen(true)
  }

  const handleEditEntry = (entry: FuelEntry) => {
    setEditingEntry(entry)
    setDrawerOpen(true)
  }

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const supabase = createClient()
    const result = await fetchFuelEntries(supabase, {
      truckId: activeFilters.truckId as string | undefined,
      driverId: activeFilters.driverId as string | undefined,
      search: activeFilters.search as string | undefined,
      dateFrom: dateRange?.from ? dateRange.from.slice(0, 10) : undefined,
      dateTo: dateRange?.to ? dateRange.to.slice(0, 10) : undefined,
      sortBy: currentSort?.field,
      sortDir: currentSort?.direction,
      page: 0,
      pageSize: 10000,
    })
    return result.entries.map((e) => {
      const truck = e.truck as { unit_number?: string } | null
      const driver = e.driver as { first_name?: string; last_name?: string } | null
      return {
        date: e.date,
        truck: truck?.unit_number ?? '',
        driver: driver ? `${driver.first_name} ${driver.last_name}` : '',
        gallons: parseFloat(e.gallons).toFixed(2),
        cost_per_gallon: parseFloat(e.cost_per_gallon).toFixed(3),
        total_cost: parseFloat(e.total_cost).toFixed(2),
        location: e.location ?? '',
        state: e.state ?? '',
        odometer: e.odometer ?? '',
        notes: e.notes ?? '',
      }
    })
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

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4">
        <FuelStats />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="fuel-entries"
            headers={CSV_HEADERS}
            fetchData={handleCsvExport}
          />
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('fuel', mode)} />
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={handleAddEntry}>
            <Plus className="mr-2 h-4 w-4" />
            Add Fuel Entry
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Fuel}
          title="No fuel entries yet"
          description="Start tracking fuel purchases to monitor fleet fuel costs and consumption."
          action={{
            label: 'Add Fuel Entry',
            onClick: handleAddEntry,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => (
                <FuelCard
                  key={entry.id}
                  entry={entry}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditEntry(entry)
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
                    label="Date"
                    field="date"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  <span className="text-xs font-medium text-muted-foreground w-[100px]">Location</span>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <SortHeader
                    label="Gallons"
                    field="gallons"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                    className="w-[80px]"
                  />
                  <span className="text-xs font-medium text-muted-foreground w-[80px]">$/gal</span>
                  <SortHeader
                    label="Total"
                    field="total_cost"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                    className="w-[80px]"
                  />
                </div>
                <div className="shrink-0 w-[40px]">
                  <span className="sr-only">Actions</span>
                </div>
              </div>

              {entries.map((entry) => (
                <FuelRow
                  key={entry.id}
                  entry={entry}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditEntry(entry)
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

      <FuelDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entry={editingEntry}
      />

      <FuelCsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
