'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Wrench } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { MAINTENANCE_STATUS_LABELS, MAINTENANCE_STATUS_COLORS } from '@/types'
import type { MaintenanceStatus } from '@/types'
import type { WorkOrder, Shop } from '@/types/database'
import { WorkOrderStats } from './work-order-stats'
import { WorkOrderListFilters, type WorkOrderFilters } from './work-order-list-filters'
import { CreateWorkOrderDialog } from './create-work-order-dialog'
import { useMaintenanceRecords } from '@/hooks/use-maintenance'
import { useShops } from '@/hooks/use-shops'
import { useTrucks } from '@/hooks/use-trucks'

interface WorkOrderListProps {
  /** Server-prefetched initial slice (first 50) — used to hydrate SSR.  */
  initialWorkOrders: WorkOrder[]
  openCount: number
  completedThisMonth: number
  closedThisMonth: number
  totalSpendThisMonth: string
}

function StatusBadge({ status }: { status: string }) {
  const s = status as MaintenanceStatus
  const colors = MAINTENANCE_STATUS_COLORS[s] ?? 'text-slate-700'
  const label = MAINTENANCE_STATUS_LABELS[s] ?? status

  const dotColor =
    s === 'new' ? 'bg-slate-400' :
    s === 'scheduled' ? 'bg-blue-400' :
    s === 'in_progress' ? 'bg-amber-400' :
    s === 'completed' ? 'bg-emerald-400' :
    'bg-zinc-400'

  return (
    <Badge variant="outline" className={cn('gap-1.5 whitespace-nowrap', colors)}>
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />
      {label}
    </Badge>
  )
}

function RowSkeleton() {
  return (
    <TableRow>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    </TableRow>
  )
}

export function WorkOrderList({
  initialWorkOrders,
  openCount,
  completedThisMonth,
  closedThisMonth,
  totalSpendThisMonth,
}: WorkOrderListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [filters, setFilters] = useState<WorkOrderFilters>({
    status: '',
    shopId: '',
    truckId: '',
    dateFrom: '',
    dateTo: '',
  })

  const { data: shopsData } = useShops()
  const shops = shopsData ?? []
  const { data: trucksData } = useTrucks({ pageSize: 200 })
  const trucks = trucksData?.trucks ?? []

  const queryFilters = useMemo(() => ({
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.truckId ? { truckId: filters.truckId } : {}),
    ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
    ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    pageSize: 50,
  }), [filters])

  const { data: maintenanceResult, isPending } = useMaintenanceRecords(queryFilters)

  // Apply shop filter client-side since fetchMaintenanceRecords doesn't have shopId filter
  const workOrders = useMemo(() => {
    const records = maintenanceResult?.records ?? initialWorkOrders
    if (!filters.shopId) return records
    return records.filter((wo) => wo.shop_id === filters.shopId)
  }, [maintenanceResult?.records, initialWorkOrders, filters.shopId])

  const truckOptions = trucks.map((t) => ({
    id: t.id,
    unit_number: t.unit_number,
    make: t.make,
    year: t.year,
  }))

  return (
    <div className="space-y-4">
      <WorkOrderStats
        openCount={openCount}
        completedThisMonth={completedThisMonth}
        closedThisMonth={closedThisMonth}
        totalSpendThisMonth={totalSpendThisMonth}
      />

      <div className="widget-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <WorkOrderListFilters
            filters={filters}
            onFiltersChange={setFilters}
            shops={shops as Shop[]}
            trucks={truckOptions}
          />
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Work Order
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[90px] font-semibold">WO #</TableHead>
                <TableHead className="w-[130px] font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Truck</TableHead>
                <TableHead className="font-semibold">Shop</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="w-[110px] text-right font-semibold">Total</TableHead>
                <TableHead className="w-[120px] font-semibold">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)
              ) : workOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-xl bg-muted p-3">
                        <Wrench className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">No work orders found</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {filters.status || filters.shopId || filters.truckId || filters.dateFrom
                            ? 'Try adjusting your filters'
                            : 'Create a work order to get started'}
                        </p>
                      </div>
                      {!filters.status && !filters.shopId && !filters.truckId && !filters.dateFrom && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowCreateDialog(true)}
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          Create work order
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                workOrders.map((wo) => {
                  const grandTotal = parseFloat(wo.grand_total ?? '0')
                  const shopName = (wo as WorkOrder & { shop?: Shop }).shop?.name ?? '—'
                  const truckLabel = wo.truck
                    ? wo.truck.unit_number
                    : '—'

                  return (
                    <TableRow
                      key={wo.id}
                      className="group cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <TableCell>
                        <Link
                          href={`/maintenance/${wo.id}`}
                          className="block font-mono text-sm font-semibold text-foreground group-hover:text-[var(--brand)] transition-colors tabular-nums"
                          aria-label={`Work order ${wo.wo_number ?? wo.id}`}
                        >
                          {wo.wo_number != null ? `#${wo.wo_number}` : '—'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <StatusBadge status={wo.status} />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <span className="text-sm font-medium text-foreground">{truckLabel}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <span className="text-sm text-foreground">{shopName}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {wo.description ?? <span className="italic">No description</span>}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <span className="font-mono text-sm tabular-nums text-foreground">
                            {grandTotal > 0
                              ? grandTotal.toLocaleString('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                })
                              : '—'}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/maintenance/${wo.id}`} className="block" tabIndex={-1}>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(wo.updated_at), { addSuffix: true })}
                          </span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateWorkOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        shops={shops as Shop[]}
        trucks={truckOptions}
      />
    </div>
  )
}
