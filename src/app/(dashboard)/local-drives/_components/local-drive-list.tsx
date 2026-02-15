'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocalDrives } from '@/hooks/use-local-drives'
import { LocalDriveCard } from './local-drive-card'
import { LocalDriveRow } from './local-drive-row'
import { LocalDriveDrawer } from './local-drive-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Navigation } from 'lucide-react'
import type { LocalDrive } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search local drives...',
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
]

export function LocalDriveList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('local-drives')
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

  const { data, isLoading } = useLocalDrives({
    status: activeFilters.status,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingDrive, setEditingDrive] = useState<LocalDrive | undefined>(undefined)

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

  if (isLoading) {
    return (
      <div>
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

  const localDrives = data?.localDrives ?? []
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={handlePageChange}
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
