'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useDrivers } from '@/hooks/use-drivers'
import { updateDriverStatus } from '@/app/actions/drivers'
import { DriverCard } from './driver-card'
import { DriverRow } from './driver-row'
import { DriverDrawer } from './driver-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, UserCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Driver } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search drivers...',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
  {
    key: 'driverType',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'company', label: 'Company' },
      { value: 'owner_operator', label: 'Owner Operator' },
    ],
  },
]

export function DriverList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const viewMode = useViewMode('drivers')
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

  const { data, isLoading } = useDrivers({
    status: activeFilters.status,
    driverType: activeFilters.driverType,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | undefined>(undefined)

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
      router.push(`/drivers?${params.toString()}`)
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
      router.push(`/drivers?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddDriver = () => {
    setEditingDriver(undefined)
    setDrawerOpen(true)
  }

  const handleEditDriver = (driver: Driver) => {
    setEditingDriver(driver)
    setDrawerOpen(true)
  }

  const handleStatusToggle = async (driver: Driver, checked: boolean) => {
    const newStatus = checked ? 'active' : 'inactive'
    await updateDriverStatus(driver.id, newStatus)
    queryClient.invalidateQueries({ queryKey: ['drivers'] })
  }

  const handleCardClick = (driver: Driver) => {
    router.push(`/drivers/${driver.id}`)
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[120px]" />
        </div>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

  const drivers = data?.drivers ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
        <div className="flex items-center gap-2">
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('drivers', mode)} />
          <Button onClick={handleAddDriver}>
            <Plus className="mr-2 h-4 w-4" />
            Add Driver
          </Button>
        </div>
      </div>

      {drivers.length === 0 ? (
        <EmptyState
          icon={UserCircle}
          title="No drivers yet"
          description="Add your first driver to start managing your fleet."
          action={{
            label: 'Add Driver',
            onClick: handleAddDriver,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {drivers.map((driver) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  onClick={() => handleCardClick(driver)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditDriver(driver)
                  }}
                  onStatusToggle={(checked) => handleStatusToggle(driver, checked)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.map((driver) => (
                <DriverRow
                  key={driver.id}
                  driver={driver}
                  onClick={() => handleCardClick(driver)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditDriver(driver)
                  }}
                  onStatusToggle={(checked) => handleStatusToggle(driver, checked)}
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

      <DriverDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        driver={editingDriver}
      />
    </div>
  )
}
