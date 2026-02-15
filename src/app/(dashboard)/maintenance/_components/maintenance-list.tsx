'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMaintenanceRecords } from '@/hooks/use-maintenance'
import { MaintenanceStats } from './maintenance-stats'
import { MaintenanceCard } from './maintenance-card'
import { MaintenanceRow } from './maintenance-row'
import { MaintenanceDrawer } from './maintenance-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Wrench } from 'lucide-react'
import { useTrucks } from '@/hooks/use-trucks'
import {
  MAINTENANCE_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from '@/types'
import type { MaintenanceRecord } from '@/types/database'

const PAGE_SIZE = 12

export function MaintenanceList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('maintenance')
  const setView = useViewStore((s) => s.setView)

  // Load trucks for filter dropdown
  const { data: trucksData } = useTrucks({ pageSize: 200 })
  const truckOptions = (trucksData?.trucks ?? []).map((t) => ({
    value: t.id,
    label: t.unit_number,
  }))

  const FILTER_CONFIG: FilterConfig[] = [
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search maintenance...',
    },
    {
      key: 'truckId',
      label: 'Truck',
      type: 'select',
      options: truckOptions,
    },
    {
      key: 'maintenanceType',
      label: 'Type',
      type: 'select',
      options: Object.entries(MAINTENANCE_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: Object.entries(MAINTENANCE_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
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

  const { data, isLoading } = useMaintenanceRecords({
    truckId: activeFilters.truckId,
    maintenanceType: activeFilters.maintenanceType,
    status: activeFilters.status,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          filters={FILTER_CONFIG}
          onFilterChange={handleFilterChange}
          activeFilters={activeFilters}
        />
        <div className="flex items-center gap-2">
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

      <MaintenanceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        record={editingRecord}
      />
    </div>
  )
}
