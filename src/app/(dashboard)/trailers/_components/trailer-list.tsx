'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTrailers } from '@/hooks/use-trailers'
import { TrailerCard } from './trailer-card'
import { TrailerRow } from './trailer-row'
import { TrailerDrawer } from './trailer-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Container } from 'lucide-react'
import type { Trailer } from '@/types/database'

const PAGE_SIZE = 12

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search trailer number, make, model...',
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
    key: 'trailerType',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'enclosed', label: 'Enclosed' },
      { value: 'flatbed', label: 'Flatbed' },
    ],
  },
]

export function TrailerList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('trailers')
  const setView = useViewStore((s) => s.setView)

  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)
  const activeFilters: Record<string, string> = {}
  for (const filter of FILTER_CONFIG) {
    const value = searchParams.get(filter.key)
    if (value) {
      activeFilters[filter.key] = value
    }
  }

  const { data, isLoading } = useTrailers({
    status: activeFilters.status,
    trailerType: activeFilters.trailerType,
    search: activeFilters.search,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTrailer, setEditingTrailer] = useState<Trailer | undefined>(undefined)

  const handleFilterChange = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`/trailers?${params.toString()}`)
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
      router.push(`/trailers?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleAddTrailer = () => {
    setEditingTrailer(undefined)
    setDrawerOpen(true)
  }

  const handleEditTrailer = (trailer: Trailer) => {
    setEditingTrailer(trailer)
    setDrawerOpen(true)
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

  const trailers = data?.trailers ?? []
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
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('trailers', mode)} />
          <Button onClick={handleAddTrailer}>
            <Plus className="mr-2 h-4 w-4" />
            Add Trailer
          </Button>
        </div>
      </div>

      {trailers.length === 0 ? (
        <EmptyState
          icon={Container}
          title="No trailers yet"
          description="Add your first trailer to manage your fleet"
          action={{
            label: 'Add Trailer',
            onClick: handleAddTrailer,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {trailers.map((trailer) => (
                <TrailerCard
                  key={trailer.id}
                  trailer={trailer}
                  onEdit={() => handleEditTrailer(trailer)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {trailers.map((trailer) => (
                <TrailerRow
                  key={trailer.id}
                  trailer={trailer}
                  onEdit={() => handleEditTrailer(trailer)}
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

      <TrailerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        trailer={editingTrailer}
      />
    </div>
  )
}
