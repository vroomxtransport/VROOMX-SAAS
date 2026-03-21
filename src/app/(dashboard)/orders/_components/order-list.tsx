'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useOrders } from '@/hooks/use-orders'
import { OrderCard } from './order-card'
import { OrderRow } from './order-row'
import { OrderDrawer } from './order-drawer'
import { OrderFilters } from './order-filters'
import { ViewToggle } from '@/components/shared/view-toggle'
import { SortHeader } from '@/components/shared/sort-header'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Car, Upload, FileUp } from 'lucide-react'
import { CSVImportDialog } from './csv-import-dialog'
import { PDFImportDialog } from './pdf-import-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { createClient } from '@/lib/supabase/client'
import { fetchOrders } from '@/lib/queries/orders'
import type { OrderWithRelations } from '@/lib/queries/orders'
import type { DateRange, SortConfig } from '@/types/filters'

const PAGE_SIZE = 20

export function OrderList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('orders')
  const setView = useViewStore((s) => s.setView)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderWithRelations | undefined>(undefined)

  // Local state for complex filter values (multi-select, date-range) that can't be serialized to simple URL params
  const [paymentStatuses, setPaymentStatuses] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [sort, setSort] = useState<SortConfig | undefined>(undefined)

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
    paymentStatuses: paymentStatuses.length > 0 ? paymentStatuses : undefined,
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    sortBy: sort?.field,
    sortDir: sort?.direction,
    page,
    pageSize: PAGE_SIZE,
  })

  // Build activeFilters for EnhancedFilterBar
  const activeFilters: Record<string, string | string[] | DateRange | undefined> = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (search) filters.q = search
    if (status) filters.status = status
    if (brokerId) filters.broker = brokerId
    if (driverId) filters.driver = driverId
    if (paymentStatuses.length > 0) filters.paymentStatuses = paymentStatuses
    if (dateRange) filters.dateRange = dateRange
    return filters
  }, [search, status, brokerId, driverId, paymentStatuses, dateRange])

  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      // Handle complex filter types locally
      if (key === 'paymentStatuses') {
        setPaymentStatuses((value as string[]) ?? [])
        // Reset page on filter change
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', '0')
        router.push(`${pathname}?${params.toString()}`)
        return
      }

      if (key === 'dateRange') {
        setDateRange(value as DateRange | undefined)
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', '0')
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

  const handleSort = useCallback((newSort: SortConfig | undefined) => {
    setSort(newSort)
  }, [])

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

  // CSV export: fetch all matching orders (no pagination)
  const handleCsvExport = useCallback(async () => {
    const supabase = createClient()
    const result = await fetchOrders(supabase, {
      search,
      status,
      brokerId,
      driverId,
      paymentStatuses: paymentStatuses.length > 0 ? paymentStatuses : undefined,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
      sortBy: sort?.field,
      sortDir: sort?.direction,
      page: 0,
      pageSize: 5000,
    })

    return result.orders.map((o) => ({
      order_number: o.order_number ?? '',
      status: o.status,
      payment_status: o.payment_status ?? '',
      vehicle: (() => {
        const firstVehicle = [o.vehicle_year, o.vehicle_make, o.vehicle_model].filter(Boolean).join(' ')
        const vehicleCount = Array.isArray(o.vehicles) ? o.vehicles.length : 1
        return vehicleCount > 1 ? `${firstVehicle} +${vehicleCount - 1} more` : firstVehicle
      })(),
      vin: o.vehicle_vin ?? '',
      broker: o.broker?.name ?? '',
      driver: o.driver ? `${o.driver.first_name} ${o.driver.last_name}` : '',
      pickup: [o.pickup_city, o.pickup_state].filter(Boolean).join(', '),
      delivery: [o.delivery_city, o.delivery_state].filter(Boolean).join(', '),
      revenue: o.revenue ?? '0',
      broker_fee: o.broker_fee ?? '0',
      created_at: o.created_at ? new Date(o.created_at).toLocaleDateString() : '',
    }))
  }, [search, status, brokerId, driverId, paymentStatuses, dateRange, sort])

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="Orders" subtitle="Manage vehicle transport orders and track their status.">
        <CsvExportButton
          filename="orders"
          headers={[
            'order_number', 'status', 'payment_status', 'vehicle', 'vin',
            'broker', 'driver', 'pickup', 'delivery', 'revenue', 'broker_fee', 'created_at',
          ]}
          fetchData={handleCsvExport}
        />
        <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('orders', mode)} />
        <Button variant="outline" onClick={() => setPdfImportOpen(true)}>
          <FileUp className="mr-2 h-4 w-4" />
          Import PDF
        </Button>
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
        resultCount={data?.total}
      />

      {/* Content */}
      {isPending ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-400">
          Failed to load orders: {error?.message ?? 'Unknown error'}
        </div>
      ) : data && data.orders.length === 0 ? (
        <EmptyState
          icon={Car}
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
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
              {/* Sort headers for list view */}
              <div className="flex items-center gap-3 px-3 py-1.5">
                <div className="w-[90px]">
                  <SortHeader
                    label="Order #"
                    field="order_number"
                    currentSort={sort}
                    onSort={handleSort}
                  />
                </div>
                <div className="shrink-0 w-[80px]">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-muted-foreground">Vehicle</span>
                </div>
                <div className="hidden md:block w-[240px]">
                  <span className="text-xs font-medium text-muted-foreground">Route</span>
                </div>
                <div className="hidden lg:block w-[120px]">
                  <span className="text-xs font-medium text-muted-foreground">Driver</span>
                </div>
                <div className="w-[70px] text-right">
                  <SortHeader
                    label="Revenue"
                    field="revenue"
                    currentSort={sort}
                    onSort={handleSort}
                    className="justify-end"
                  />
                </div>
                <div className="w-[32px]" />
              </div>

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

      {/* PDF Import Dialog */}
      <PDFImportDialog
        open={pdfImportOpen}
        onOpenChange={setPdfImportOpen}
      />
    </div>
  )
}
