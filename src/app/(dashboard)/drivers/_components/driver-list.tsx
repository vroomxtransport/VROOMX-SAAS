'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useDrivers } from '@/hooks/use-drivers'
import { updateDriverStatus } from '@/app/actions/drivers'
import { DriverCard } from './driver-card'
import { DriverRow } from './driver-row'
import { DriverDrawer } from './driver-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, UserCircle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDrivers } from '@/lib/queries/drivers'
import {
  DRIVER_TYPE_LABELS,
  DRIVER_PAY_TYPE_LABELS,
} from '@/types'
import type { Driver } from '@/types/database'
import type { DriverType, DriverPayType } from '@/types'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'

const PAGE_SIZE = 12

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: [
      { value: 'active', label: 'Active', color: 'bg-emerald-100 text-emerald-800' },
      { value: 'inactive', label: 'Inactive', color: 'bg-muted text-muted-foreground' },
    ],
  },
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Driver name...',
  },
  {
    key: 'driverType',
    label: 'Type',
    type: 'select',
    options: Object.entries(DRIVER_TYPE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: 'payTypes',
    label: 'Pay Type',
    type: 'multi-select',
    options: Object.entries(DRIVER_PAY_TYPE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
]

export function DriverList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const viewMode = useViewMode('drivers')
  const setView = useViewStore((s) => s.setView)

  // Local state for complex filter values (multi-select cannot serialize to simple URL params)
  const [payTypes, setPayTypes] = useState<string[]>([])
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  // Parse simple filters from URL
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const status = searchParams.get('status') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const driverType = searchParams.get('driverType') ?? undefined

  const { data, isLoading } = useDrivers({
    status,
    driverType,
    search,
    payTypes: payTypes.length > 0 ? payTypes : undefined,
    sortBy: sort?.field,
    sortDir: sort?.direction,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | undefined>(undefined)

  // Build activeFilters for EnhancedFilterBar
  const activeFilters = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.search = search
    if (status) filters.status = status
    if (driverType) filters.driverType = driverType
    if (payTypes.length > 0) filters.payTypes = payTypes
    return filters
  }, [search, status, driverType, payTypes])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      // Handle multi-select locally
      if (key === 'payTypes') {
        setPayTypes((value as string[]) ?? [])
        // Reset to first page on filter change
        const params = new URLSearchParams(searchParams.toString())
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
        return
      }

      // Handle simple string filters via URL params
      const params = new URLSearchParams(searchParams.toString())
      if (typeof value === 'string' && value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset to first page on filter change
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page === 0) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleSort = useCallback((newSort: SortConfig | undefined) => {
    setSort(newSort)
  }, [])

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

  const handleCsvExport = useCallback(async () => {
    const supabase = createClient()
    const result = await fetchDrivers(supabase, {
      status,
      driverType,
      search,
      payTypes: payTypes.length > 0 ? payTypes : undefined,
      sortBy: sort?.field,
      sortDir: sort?.direction,
      page: 0,
      pageSize: 10000,
    })
    return result.drivers.map((d) => ({
      first_name: d.first_name,
      last_name: d.last_name,
      driver_status: d.driver_status,
      driver_type: DRIVER_TYPE_LABELS[d.driver_type as DriverType] ?? d.driver_type,
      pay_type: DRIVER_PAY_TYPE_LABELS[d.pay_type as DriverPayType] ?? d.pay_type,
      pay_rate: d.pay_rate,
      phone: d.phone ?? '',
      email: d.email ?? '',
    }))
  }, [status, driverType, search, payTypes, sort])

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

  const drivers = data?.drivers ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CsvExportButton
            filename="drivers"
            headers={['first_name', 'last_name', 'driver_status', 'driver_type', 'pay_type', 'pay_rate', 'phone', 'email']}
            fetchData={handleCsvExport}
          />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              {/* Sort headers for list view */}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <SortHeader
                    label="Name"
                    field="last_name"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 w-[180px]">
                  <span className="text-xs font-medium text-muted-foreground">Status / Type</span>
                </div>
                <div className="hidden md:flex items-center gap-3 shrink-0 w-[200px]">
                  <span className="text-xs font-medium text-muted-foreground">Contact</span>
                </div>
                <div className="hidden lg:block shrink-0 w-[160px]">
                  <SortHeader
                    label="Pay Rate"
                    field="pay_rate"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="shrink-0 w-[76px]" />
              </div>

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
