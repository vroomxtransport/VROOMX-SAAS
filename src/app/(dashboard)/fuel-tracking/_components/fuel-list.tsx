'use client'

import { useState, useCallback } from 'react'
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
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Fuel } from 'lucide-react'
import type { FuelEntry } from '@/types/database'

const PAGE_SIZE = 12

export function FuelList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('fuel')
  const setView = useViewStore((s) => s.setView)

  // Fetch trucks and drivers for filter selects
  const { data: trucksData } = useTrucks({ pageSize: 100 })
  const { data: driversData } = useDrivers({ pageSize: 100 })

  const truckOptions = (trucksData?.trucks ?? []).map((t) => ({
    value: t.id,
    label: t.unit_number,
  }))

  const driverOptions = (driversData?.drivers ?? []).map((d) => ({
    value: d.id,
    label: `${d.first_name} ${d.last_name}`,
  }))

  const FILTER_CONFIG: FilterConfig[] = [
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search fuel entries...',
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
  ]

  // Parse filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const activeFilters: Record<string, string> = {}
  for (const filter of FILTER_CONFIG) {
    const value = searchParams.get(filter.key)
    if (value) {
      activeFilters[filter.key] = value
    }
  }

  const { data, isLoading } = useFuelEntries({
    truckId: activeFilters.truckId,
    driverId: activeFilters.driverId,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FuelEntry | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
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

  const handleAddEntry = () => {
    setEditingEntry(undefined)
    setDrawerOpen(true)
  }

  const handleEditEntry = (entry: FuelEntry) => {
    setEditingEntry(entry)
    setDrawerOpen(true)
  }

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('fuel', mode)} />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}

      <FuelDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        entry={editingEntry}
      />
    </div>
  )
}
