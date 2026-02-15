'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useOrders } from '@/hooks/use-orders'
import { OrderCard } from './order-card'
import { OrderRow } from './order-row'
import { OrderDrawer } from './order-drawer'
import { OrderFilters } from './order-filters'
import { ViewToggle } from '@/components/shared/view-toggle'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, PackageOpen, Upload } from 'lucide-react'
import { CSVImportDialog } from './csv-import-dialog'
import { PageHeader } from '@/components/shared/page-header'
import type { OrderWithRelations } from '@/lib/queries/orders'

const PAGE_SIZE = 20

export function OrderList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('orders')
  const setView = useViewStore((s) => s.setView)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderWithRelations | undefined>(undefined)

  // Parse URL search params for filters
  const search = searchParams.get('q') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const brokerId = searchParams.get('broker') ?? undefined
  const driverId = searchParams.get('driver') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '0', 10)

  const { data, isPending, isError, error } = useOrders({
    search,
    status,
    brokerId,
    driverId,
    page,
    pageSize: PAGE_SIZE,
  })

  const activeFilters: Record<string, string> = {}
  if (search) activeFilters.q = search
  if (status) activeFilters.status = status
  if (brokerId) activeFilters.broker = brokerId
  if (driverId) activeFilters.driver = driverId

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

  const handleAddOrder = useCallback(() => {
    setEditingOrder(undefined)
    setDrawerOpen(true)
  }, [])

  const handleEditOrder = useCallback((order: OrderWithRelations) => {
    setEditingOrder(order)
    setDrawerOpen(true)
  }, [])

  const handleCardClick = useCallback(
    (order: OrderWithRelations) => {
      router.push(`/orders/${order.id}`)
    },
    [router]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="Orders" subtitle="Manage vehicle transport orders and track their status.">
        <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('orders', mode)} />
        <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
        <Button onClick={handleAddOrder}>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </PageHeader>

      {/* Filters */}
      <OrderFilters
        activeFilters={activeFilters}
        onFilterChange={setFilter}
      />

      {/* Content */}
      {isPending ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] rounded-lg" />
            ))}
          </div>
        )
      ) : isError ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load orders: {error?.message ?? 'Unknown error'}
        </div>
      ) : data && data.orders.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No orders yet"
          description="Create your first order to get started with vehicle transport management."
          action={{
            label: 'New Order',
            onClick: handleAddOrder,
          }}
        />
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {data?.orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={() => handleCardClick(order)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditOrder(order)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {data?.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onClick={() => handleCardClick(order)}
                  onEdit={(e) => {
                    e.stopPropagation()
                    handleEditOrder(order)
                  }}
                />
              ))}
            </div>
          )}

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
      <OrderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        order={editingOrder}
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
      />
    </div>
  )
}
