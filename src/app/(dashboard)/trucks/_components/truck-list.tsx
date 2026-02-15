'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTrucks } from '@/hooks/use-trucks'
import { TruckCard } from './truck-card'
import { TruckRow } from './truck-row'
import { TruckDrawer } from './truck-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Truck as TruckIcon } from 'lucide-react'
import type { Truck } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search unit, make, model...',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'maintenance', label: 'Maintenance' },
    ],
  },
  {
    key: 'truckType',
    label: 'Type',
    type: 'select',
    options: [
      { value: '7_car', label: '7-Car Hauler' },
      { value: '8_car', label: '8-Car Hauler' },
      { value: '9_car', label: '9-Car Hauler' },
      { value: 'flatbed', label: 'Flatbed' },
      { value: 'enclosed', label: 'Enclosed' },
    ],
  },
]

export function TruckList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('trucks')
  const setView = useViewStore((s) => s.setView)

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const activeFilters: Record<string, string> = {}
  for (const filter of FILTER_CONFIG) {
    const value = searchParams.get(filter.key)
    if (value) {
      activeFilters[filter.key] = value
    }
  }

  const { data, isLoading } = useTrucks({
    status: activeFilters.status,
    truckType: activeFilters.truckType,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTruck, setEditingTruck] = useState<Truck | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
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
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
        <div className="flex items-center gap-2">
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
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
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
