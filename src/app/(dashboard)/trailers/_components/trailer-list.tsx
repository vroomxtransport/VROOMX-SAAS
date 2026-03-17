'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTrailers } from '@/hooks/use-trailers'
import { TrailerCard } from './trailer-card'
import { TrailerRow } from './trailer-row'
import { TrailerDrawer } from './trailer-drawer'
import { ViewToggle } from '@/components/shared/view-toggle'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Container } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchTrailers } from '@/lib/queries/trailers'
import {
  TRAILER_TYPES,
  TRAILER_TYPE_LABELS,
  TRAILER_STATUS_LABELS,
} from '@/types'
import type { TrailerType, TrailerStatus } from '@/types'
import type { Trailer } from '@/types/database'
import type { EnhancedFilterConfig, DateRange, SortConfig } from '@/types/filters'

const PAGE_SIZE = 12

// Status pill colors: active=emerald, inactive=muted, maintenance=amber
const STATUS_PILL_OPTIONS = [
  { value: 'active', label: TRAILER_STATUS_LABELS.active, color: 'bg-emerald-600 text-white' },
  { value: 'inactive', label: TRAILER_STATUS_LABELS.inactive, color: 'bg-muted-foreground text-white' },
  { value: 'maintenance', label: TRAILER_STATUS_LABELS.maintenance, color: 'bg-amber-500 text-white' },
]

const TRAILER_TYPE_OPTIONS = TRAILER_TYPES.map((t) => ({
  value: t,
  label: TRAILER_TYPE_LABELS[t as TrailerType],
}))

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: STATUS_PILL_OPTIONS,
  },
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Trailer #, make, model...',
  },
  {
    key: 'trailerType',
    label: 'Type',
    type: 'select',
    options: TRAILER_TYPE_OPTIONS,
  },
]

export function TrailerList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('trailers')
  const setView = useViewStore((s) => s.setView)

  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

  // Parse URL search params for simple filters
  const search = searchParams.get('search') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const trailerType = searchParams.get('trailerType') ?? undefined
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const { data, isLoading } = useTrailers({
    status,
    trailerType,
    search,
    sortBy: sort?.field,
    sortDir: sort?.direction,
    page: currentPage,
    pageSize: PAGE_SIZE,
  })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTrailer, setEditingTrailer] = useState<Trailer | undefined>(undefined)

  // Build activeFilters for EnhancedFilterBar
  const activeFilters = useMemo(() => {
    const filters: Record<string, string | undefined> = {}
    if (search) filters.search = search
    if (status) filters.status = status
    if (trailerType) filters.trailerType = trailerType
    return filters
  }, [search, status, trailerType])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (typeof value === 'string' && value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset page on filter change
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

  const handleAddTrailer = useCallback(() => {
    setEditingTrailer(undefined)
    setDrawerOpen(true)
  }, [])

  const handleEditTrailer = useCallback((trailer: Trailer) => {
    setEditingTrailer(trailer)
    setDrawerOpen(true)
  }, [])

  // CSV export: fetch all matching trailers (no pagination)
  const handleCsvExport = useCallback(async () => {
    const supabase = createClient()
    const result = await fetchTrailers(supabase, {
      status,
      trailerType,
      search,
      sortBy: sort?.field,
      sortDir: sort?.direction,
      page: 0,
      pageSize: 5000,
    })

    return result.trailers.map((t) => ({
      trailer_number: t.trailer_number,
      status: TRAILER_STATUS_LABELS[t.status as TrailerStatus] ?? t.status,
      type: TRAILER_TYPE_LABELS[t.trailer_type as TrailerType] ?? t.trailer_type,
      year: t.year ?? '',
      make: t.make ?? '',
      model: t.model ?? '',
      vin: t.vin ?? '',
      assigned_truck: t.assigned_truck?.unit_number ?? '',
      created_at: t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
    }))
  }, [status, trailerType, search, sort])

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
    <div className="space-y-4">
      {/* Filter bar with status pills, search, type select */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            filename="trailers"
            headers={[
              'trailer_number', 'status', 'type', 'year', 'make',
              'model', 'vin', 'assigned_truck', 'created_at',
            ]}
            fetchData={handleCsvExport}
          />
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
              {/* Sort headers for list view */}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <div className="w-[100px]">
                  <SortHeader
                    label="Trailer #"
                    field="trailer_number"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="shrink-0 w-[80px]">
                  <SortHeader
                    label="Status"
                    field="status"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="shrink-0 w-[80px]">
                  <span className="text-xs font-medium text-muted-foreground">Type</span>
                </div>
                <div className="hidden md:block flex-1 min-w-0">
                  <SortHeader
                    label="Vehicle"
                    field="make"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="hidden md:block shrink-0 w-[100px]">
                  <span className="text-xs font-medium text-muted-foreground">Truck</span>
                </div>
                <div className="hidden lg:block shrink-0 w-[140px]">
                  <span className="text-xs font-medium text-muted-foreground">VIN</span>
                </div>
                <div className="shrink-0 w-[150px]">
                  <span className="text-xs font-medium text-muted-foreground">Actions</span>
                </div>
              </div>

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
