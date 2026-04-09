'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useOrders } from '@/hooks/use-orders'
import { useQueryClient } from '@tanstack/react-query'
import { OrderCard } from './order-card'
import { OrdersDataTable } from './orders-data-table'
import { OrderDrawer } from './order-drawer'
import { OrderFilters } from './order-filters'
import { MobileOrderStatusTabs } from './mobile-order-status-tabs'
import { ViewToggle } from '@/components/shared/view-toggle'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import { useViewMode, useViewStore } from '@/stores/view-store'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Car, Upload, FileUp, Search, X } from 'lucide-react'
import { CSVImportDialog } from './csv-import-dialog'
import { PDFImportDialog } from './pdf-import-dialog'
import { PageHeader } from '@/components/shared/page-header'
import { MobileFilterSheet } from '@/components/shared/mobile-filter-sheet'
import { PullToRefresh } from '@/components/shared/pull-to-refresh'
import { Fab } from '@/components/shared/fab'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { createClient } from '@/lib/supabase/client'
import { fetchOrders } from '@/lib/queries/orders'
import { useBrokers } from '@/hooks/use-brokers'
import { useDrivers } from '@/hooks/use-drivers'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import type { OrderWithRelations } from '@/lib/queries/orders'
import type { DateRange, SortConfig } from '@/types/filters'

// ── Mobile search input with debounce ─────────────────────────────────────────
function MobileSearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string | undefined) => void
}) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleChange = (v: string) => {
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v || undefined), 300)
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder="Order #, VIN, make, model..."
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        className="h-10 pl-9 pr-9 text-sm w-full"
      />
      {local && (
        <button
          onClick={() => {
            setLocal('')
            onChange(undefined)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function OrderList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewMode = useViewMode('orders')
  const setView = useViewStore((s) => s.setView)
  const { isMobile } = useIsMobile()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<OrderWithRelations | undefined>(undefined)
  const [pageSize, setPageSize] = useState(25)

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
    pageSize,
  })

  // Mobile status tab counts — derived from the current result set (no extra query)
  // Falls back to 0 for each status if data not yet loaded
  const statusCounts = useMemo((): Record<string, number> => {
    if (!data) return {}
    // When filtered, the count only reflects the current status
    // We surface per-status counts from the total when no status filter is active
    const counts: Record<string, number> = {}
    if (!status && data.orders) {
      for (const order of data.orders) {
        counts[order.status] = (counts[order.status] ?? 0) + 1
      }
    } else if (status) {
      counts[status] = data.total
    }
    return counts
  }, [data, status])

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

  // Count non-search, non-status active filters for the mobile filter badge
  const mobileActiveFilterCount = useMemo(() => {
    let count = 0
    if (brokerId) count++
    if (driverId) count++
    if (paymentStatuses.length > 0) count++
    if (dateRange) count++
    return count
  }, [brokerId, driverId, paymentStatuses, dateRange])

  const setFilter = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      // Handle complex filter types locally
      if (key === 'paymentStatuses') {
        setPaymentStatuses((value as string[]) ?? [])
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

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size)
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', '0')
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

  const handleMobileStatusChange = useCallback(
    (newStatus: string | null) => {
      setFilter('status', newStatus ?? undefined)
    },
    [setFilter]
  )

  const handleClearAllFilters = useCallback(() => {
    setPaymentStatuses([])
    setDateRange(undefined)
    const params = new URLSearchParams()
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname])

  const handlePullRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['orders'] })
  }, [queryClient])

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

  // On mobile: always use card/grid view regardless of store setting
  const effectiveViewMode = isMobile ? 'grid' : viewMode

  // ── Mobile filter sheet content ──────────────────────────────────────────────
  // We inline a simplified broker/driver/payment selector for the sheet
  const { data: brokersData } = useBrokers({ pageSize: 100 })
  const { data: driversData } = useDrivers({ pageSize: 100 })

  const mobileFilterContent = (
    <div className="space-y-5">
      {/* Broker */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Broker</p>
        <Select
          value={brokerId ?? ''}
          onValueChange={(v) => setFilter('broker', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="All brokers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brokers</SelectItem>
            {brokersData?.brokers?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Driver */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver</p>
        <Select
          value={driverId ?? ''}
          onValueChange={(v) => setFilter('driver', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="All drivers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drivers</SelectItem>
            {driversData?.drivers?.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.first_name} {d.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payment status checkboxes */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Status</p>
        <div className="space-y-2">
          {['unpaid', 'partial', 'paid', 'overpaid'].map((ps) => (
            <label key={ps} className="flex items-center gap-3 cursor-pointer py-1">
              <Checkbox
                checked={paymentStatuses.includes(ps)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...paymentStatuses, ps]
                    : paymentStatuses.filter((v) => v !== ps)
                  setPaymentStatuses(next)
                }}
              />
              <span className="text-sm capitalize">{ps}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title="Orders" subtitle="Manage vehicle transport orders and track their status.">
        {/* Desktop-only actions */}
        <span className="hidden md:contents">
          <CsvExportButton
            filename="orders"
            headers={[
              'order_number', 'status', 'payment_status', 'vehicle', 'vin',
              'broker', 'driver', 'pickup', 'delivery', 'revenue', 'broker_fee', 'created_at',
            ]}
            fetchData={handleCsvExport}
          />
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
        </span>
        {/* ViewToggle: hidden on mobile */}
        <span className="hidden md:flex">
          <ViewToggle viewMode={viewMode} onViewChange={(mode) => setView('orders', mode)} />
        </span>
      </PageHeader>

      {/* Desktop filters — hidden on mobile */}
      <div className="hidden md:block">
        <OrderFilters
          activeFilters={activeFilters}
          onFilterChange={setFilter}
          resultCount={data?.total}
        />
      </div>

      {/* Mobile controls — sticky area above card list */}
      {isMobile && (
        <div className="space-y-2 md:hidden">
          {/* Full-width search */}
          <MobileSearchInput
            value={search ?? ''}
            onChange={(v) => setFilter('q', v)}
          />

          {/* Status tabs + filter sheet trigger row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MobileOrderStatusTabs
                activeStatus={status ?? null}
                onStatusChange={handleMobileStatusChange}
                counts={statusCounts}
              />
            </div>
            <MobileFilterSheet
              activeCount={mobileActiveFilterCount}
              onClearAll={handleClearAllFilters}
            >
              {mobileFilterContent}
            </MobileFilterSheet>
          </div>

          {/* Result count pill */}
          {data?.total !== undefined && (
            <p className="text-xs text-muted-foreground px-0.5">
              {data.total.toLocaleString()} order{data.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <PullToRefresh onRefresh={handlePullRefresh}>
        {isPending ? (
          effectiveViewMode === 'grid' ? (
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
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
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
            {effectiveViewMode === 'grid' ? (
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
              <OrdersDataTable
                orders={data?.orders ?? []}
                sort={sort}
                onSort={handleSort}
                onRowClick={handleCardClick}
                onEdit={handleEditOrder}
              />
            )}

            {data && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </>
        )}
      </PullToRefresh>

      {/* Mobile FAB — new order */}
      <Fab
        icon={<Plus size={24} />}
        label="New Order"
        onClick={handleAddOrder}
      />

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
