'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useBrokers } from '@/hooks/use-brokers'
import { BrokerCard } from './broker-card'
import { BrokerDrawer } from './broker-drawer'
import { FilterBar, type FilterConfig } from '@/components/shared/filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Building2 } from 'lucide-react'
import type { Broker } from '@/types/database'

const PAGE_SIZE = 20

const filterConfig: FilterConfig[] = [
  {
    key: 'q',
    label: 'Search',
    type: 'search',
    placeholder: 'Search brokers by name...',
  },
]

export function BrokerList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBroker, setEditingBroker] = useState<Broker | undefined>(undefined)

  // Parse URL search params for filters
  const search = searchParams.get('q') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const { data, isPending, isError, error } = useBrokers({
    search,
    page,
    pageSize: PAGE_SIZE,
  })

  const activeFilters: Record<string, string> = {}
  if (search) activeFilters.q = search

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brokers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your broker directory and payment terms.
          </p>
        </div>
        <Button onClick={handleAddBroker}>
          <Plus className="mr-2 h-4 w-4" />
          Add Broker
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filterConfig}
        onFilterChange={setFilter}
        activeFilters={activeFilters}
      />

      {/* Content */}
      {isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load brokers: {error?.message ?? 'Unknown error'}
        </div>
      ) : data && data.brokers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No brokers yet"
          description="Add your first broker to start tracking payment terms and orders."
          action={{
            label: 'Add Broker',
            onClick: handleAddBroker,
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.brokers.map((broker) => (
              <BrokerCard
                key={broker.id}
                broker={broker}
                onClick={() => handleCardClick(broker.id)}
                onEdit={() => handleEditBroker(broker)}
              />
            ))}
          </div>

          {data && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={setPage}
            />
          )}
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
