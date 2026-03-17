'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useBrokers } from '@/hooks/use-brokers'
import { createClient } from '@/lib/supabase/client'
import { fetchBrokers } from '@/lib/queries/brokers'
import { BrokerCard } from './broker-card'
import { BrokerDrawer } from './broker-drawer'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { ViewToggle } from '@/components/shared/view-toggle'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Building2, Pencil, Mail, Phone } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { PAYMENT_TERMS_LABELS } from '@/types'
import type { Broker } from '@/types/database'
import type { EnhancedFilterConfig, SortConfig, DateRange } from '@/types/filters'

const PAGE_SIZE = 20

const CSV_HEADERS = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'payment_terms', 'factoring_company']

const filterConfig: EnhancedFilterConfig[] = [
  {
    key: 'q',
    label: 'Search',
    type: 'search',
    placeholder: 'Broker name, email...',
  },
]

export function BrokerList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBroker, setEditingBroker] = useState<Broker | undefined>(undefined)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Parse URL search params for filters + sort
  const search = searchParams.get('q') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const sortBy = searchParams.get('sortBy') ?? undefined
  const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined

  const sort: SortConfig | undefined = sortBy
    ? { field: sortBy, direction: sortDir ?? 'asc' }
    : undefined

  const { data, isPending, isError, error } = useBrokers({
    search,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir,
  })

  const activeFilters: Record<string, string | string[] | DateRange | undefined> = {}
  if (search) activeFilters.q = search

  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && typeof value === 'string') {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset page on filter change
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleSort = useCallback(
    (newSort: SortConfig | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newSort) {
        params.set('sortBy', newSort.field)
        params.set('sortDir', newSort.direction)
      } else {
        params.delete('sortBy')
        params.delete('sortDir')
      }
      params.set('page', '0')
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(newPage))
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const handleAddBroker = useCallback(() => {
    setEditingBroker(undefined)
    setDrawerOpen(true)
  }, [])

  const handleEditBroker = useCallback((broker: Broker) => {
    setEditingBroker(broker)
    setDrawerOpen(true)
  }, [])

  const handleCardClick = useCallback(
    (brokerId: string) => {
      router.push(`/brokers/${brokerId}`)
    },
    [router]
  )

  const fetchCsvData = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const supabase = createClient()
    const result = await fetchBrokers(supabase, {
      search,
      page: 0,
      pageSize: 10000,
      sortBy,
      sortDir,
    })
    return result.brokers.map((b) => ({
      name: b.name,
      email: b.email ?? '',
      phone: b.phone ?? '',
      address: b.address ?? '',
      city: b.city ?? '',
      state: b.state ?? '',
      zip: b.zip ?? '',
      payment_terms: b.payment_terms ?? '',
      factoring_company: b.factoring_company ?? '',
    }))
  }, [search, sortBy, sortDir])

  const brokers = data?.brokers ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="Brokers" subtitle="Manage your broker directory and payment terms.">
        <Button onClick={handleAddBroker}>
          <Plus className="mr-2 h-4 w-4" />
          Add Broker
        </Button>
      </PageHeader>

      {/* Filters + controls */}
      <div className="space-y-3">
        <EnhancedFilterBar
          filters={filterConfig}
          onFilterChange={setFilter}
          activeFilters={activeFilters}
          resultCount={data ? total : undefined}
        />

        <div className="flex items-center justify-between gap-2">
          <ViewToggle viewMode={viewMode} onViewChange={setViewMode} />
          <CsvExportButton
            filename="brokers"
            headers={CSV_HEADERS}
            fetchData={fetchCsvData}
          />
        </div>
      </div>

      {/* Content */}
      {isPending ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load brokers: {error?.message ?? 'Unknown error'}
        </div>
      ) : brokers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brokers yet"
          description="Add your first broker to start tracking payment terms and orders."
          action={{
            label: 'Add Broker',
            onClick: handleAddBroker,
          }}
        />
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {brokers.map((broker) => (
              <BrokerCard
                key={broker.id}
                broker={broker}
                onClick={() => handleCardClick(broker.id)}
                onEdit={() => handleEditBroker(broker)}
              />
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          {/* List view */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1fr_140px_140px_100px_48px] gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
              <SortHeader
                label="Name"
                field="name"
                currentSort={sort}
                onSort={handleSort}
              />
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <span className="text-xs font-medium text-muted-foreground">Factoring</span>
              <span className="text-xs font-medium text-muted-foreground">Terms</span>
              <span className="sr-only">Actions</span>
            </div>

            {/* Table rows */}
            {brokers.map((broker) => (
              <div
                key={broker.id}
                role="row"
                tabIndex={0}
                onClick={() => handleCardClick(broker.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleCardClick(broker.id)
                  }
                }}
                className="grid grid-cols-[1fr_1fr_140px_140px_100px_48px] gap-2 items-center border-b border-border px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30 last:border-b-0"
              >
                <div className="truncate text-sm font-medium text-foreground">
                  {broker.name}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {broker.email ? (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {broker.email}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">--</span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {broker.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {broker.phone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">--</span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {broker.factoring_company ?? (
                    <span className="text-muted-foreground/50">--</span>
                  )}
                </div>
                <div>
                  {broker.payment_terms ? (
                    <Badge variant="outline" className="text-xs">
                      {PAYMENT_TERMS_LABELS[broker.payment_terms]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">--</span>
                  )}
                </div>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground/60 hover:text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditBroker(broker)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit {broker.name}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Drawer */}
      <BrokerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        broker={editingBroker}
      />
    </div>
  )
}
