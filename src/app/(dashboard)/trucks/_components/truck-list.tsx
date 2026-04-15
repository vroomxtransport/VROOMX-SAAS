'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTrucks } from '@/hooks/use-trucks'
import { TruckCard } from './truck-card'
import { TruckRow } from './truck-row'
import { TruckDrawer } from './truck-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Truck as TruckIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchTrucks } from '@/lib/queries/trucks'
import {
  TRUCK_STATUS_LABELS,
  TRUCK_TYPE_LABELS,
} from '@/types'
import type { TruckStatus, TruckType } from '@/types'
import type { EnhancedFilterConfig } from '@/types/filters'
import type { SortConfig } from '@/types/filters'
import type { Truck } from '@/types/database'

const ENHANCED_FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: (Object.entries(TRUCK_STATUS_LABELS) as [TruckStatus, string][]).map(
      ([value, label]) => ({
        value,
        label,
        color:
          value === 'active'
            ? 'text-emerald-800'
            : value === 'maintenance'
              ? 'text-amber-800'
              : 'bg-muted text-muted-foreground',
      })
    ),
  },
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Unit #, make, model...',
  },
  {
    key: 'truckType',
    label: 'Type',
    type: 'select',
    options: (Object.entries(TRUCK_TYPE_LABELS) as [TruckType, string][]).map(
      ([value, label]) => ({ value, label })
    ),
  },
]

const CSV_HEADERS = [
  'unit_number',
  'truck_status',
  'truck_type',
  'year',
  'make',
  'model',
  'vin',
  'ownership',
]

export function TruckList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('trucks')
  const setView = useViewStore((s) => s.setView)

  const [pageSize, setPageSize] = useState(25)

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const activeFilters = useMemo(() => {
    const filters: Record<string, string> = {}
    for (const filter of ENHANCED_FILTER_CONFIG) {
      const value = searchParams.get(filter.key)
      if (value) {
        filters[filter.key] = value
      }
    }
    return filters
  }, [searchParams])

  // Parse sort from URL
  const currentSort = useMemo((): SortConfig | undefined => {
    const sortBy = searchParams.get('sortBy')
    const sortDir = searchParams.get('sortDir')
    if (sortBy && (sortDir === 'asc' || sortDir === 'desc')) {
      return { field: sortBy, direction: sortDir }
    }
    return undefined
  }, [searchParams])

  const { data, isLoading } = useTrucks({
    status: activeFilters.status,
    truckType: activeFilters.truckType,
    search: activeFilters.search,
    page: currentPage,
    pageSize,
    sortBy: currentSort?.field,
    sortDir: currentSort?.direction,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTruck, setEditingTruck] = useState<Truck | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | { from: string; to: string } | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset to first page on filter change
      params.delete('page')
      router.push(`/trucks?${params.toString()}`)
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
      router.push(`/trucks?${params.toString()}`)
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
      router.push(`/trucks?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
      router.push(`/trucks?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddTruck = () => {
    setEditingTruck(undefined)
    setDrawerOpen(true)
  }

  const handleEditTruck = (truck: Truck) => {
    setEditingTruck(truck)
    setDrawerOpen(true)
  }

  const handleCardClick = (truck: Truck) => {
    router.push(`/trucks/${truck.id}`)
  }

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const supabase = createClient()
    const result = await fetchTrucks(supabase, {
      status: activeFilters.status,
      truckType: activeFilters.truckType,
      search: activeFilters.search,
      page: 0,
      pageSize: 10000,
      sortBy: currentSort?.field,
      sortDir: currentSort?.direction,
    })
    return result.trucks.map((t) => ({
      unit_number: t.unit_number,
      truck_status: t.truck_status,
      truck_type: t.truck_type,
      year: t.year ?? '',
      make: t.make ?? '',
      model: t.model ?? '',
      vin: t.vin ?? '',
      ownership: t.ownership ?? '',
    }))
  }, [activeFilters, currentSort])

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

  const trucks = data?.trucks ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={ENHANCED_FILTER_CONFIG}
            onFilterChange={handleFilterChange}
            activeFilters={activeFilters}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="trucks"
            headers={CSV_HEADERS}
            fetchData={handleCsvExport}
          />
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('trucks', mode)} />
          <Button onClick={handleAddTruck}>
            <Plus className="mr-2 h-4 w-4" />
            Add Truck
          </Button>
        </div>
      </div>

      {trucks.length === 0 ? (
        <EmptyState
          icon={TruckIcon}
          title="No trucks yet"
          description="Add your first truck to manage your fleet"
          action={{
            label: 'Add Truck',
            onClick: handleAddTruck,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {trucks.map((truck) => (
                <TruckCard
                  key={truck.id}
                  truck={truck}
                  onClick={() => handleCardClick(truck)}
                  onEdit={() => handleEditTruck(truck)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Sort headers for list view */}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <div className="w-[100px]">
                  <SortHeader
                    label="Unit #"
                    field="unit_number"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">Status / Type</span>
                </div>
                <div className="hidden md:block flex-1">
                  <SortHeader
                    label="Make"
                    field="make"
                    currentSort={currentSort}
                    onSort={handleSortChange}
                  />
                </div>
                <div className="hidden lg:block w-[140px]">
                  <span className="text-xs font-medium text-muted-foreground">VIN</span>
                </div>
                <div className="shrink-0 w-[155px]">
                  <span className="text-xs font-medium text-muted-foreground">Actions</span>
                </div>
              </div>

              {trucks.map((truck) => (
                <TruckRow
                  key={truck.id}
                  truck={truck}
                  onClick={() => handleCardClick(truck)}
                  onEdit={() => handleEditTruck(truck)}
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

      <TruckDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        truck={editingTruck}
      />
    </div>
  )
}
