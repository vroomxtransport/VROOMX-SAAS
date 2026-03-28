'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type ColumnResizeMode,
} from '@tanstack/react-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Pencil, ArrowRight, Calendar, UserPlus, UserCog, UserMinus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useDrivers } from '@/hooks/use-drivers'
import { useQueryClient } from '@tanstack/react-query'
import { updateOrder, deleteOrder } from '@/app/actions/orders'
import type { OrderWithRelations } from '@/lib/queries/orders'
import type { SortConfig } from '@/types/filters'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

// ─── Actions Cell ─────────────────────────────────────────────────────────────

function ActionsCell({ order, onEdit, onRowClick }: { order: OrderWithRelations; onEdit: (order: OrderWithRelations) => void; onRowClick: (order: OrderWithRelations) => void }) {
  const [showDriverPopover, setShowDriverPopover] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const queryClient = useQueryClient()
  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })

  async function handleAssignDriver(driverId: string) {
    setIsAssigning(true)
    try {
      const result = await updateOrder(order.id, { driverId })
      if (!('error' in result && result.error)) {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        setShowDriverPopover(false)
      }
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleUnassignDriver() {
    setIsAssigning(true)
    try {
      const result = await updateOrder(order.id, { driverId: '' })
      if (!('error' in result && result.error)) {
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleDelete() {
    const result = await deleteOrder(order.id)
    if (!('error' in result && result.error)) {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
  }

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={() => onEdit(order)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>

        <Popover open={showDriverPopover} onOpenChange={setShowDriverPopover}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-xs" disabled={isAssigning}>
                  {order.driver ? <UserCog className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{order.driver ? 'Reassign' : 'Assign'}</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-56 p-2" align="end">
            <p className="text-xs font-semibold text-foreground/60 mb-2">Select driver</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {driversData?.drivers?.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleAssignDriver(d.id)}
                  disabled={isAssigning}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {d.first_name} {d.last_name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {order.driver && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="hover:text-destructive" onClick={handleUnassignDriver} disabled={isAssigning}>
                <UserMinus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Unassign</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="hover:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete Order ${order.order_number ?? 'Draft'}?`}
        description="This will permanently delete the order and remove it from any assigned trip."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ─── Sortable Header ──────────────────────────────────────────────────────────

function SortableHeader({ label, field, sort, onSort }: { label: string; field: string; sort?: SortConfig; onSort: (s: SortConfig | undefined) => void }) {
  const isActive = sort?.field === field
  const dir = isActive ? sort?.direction : undefined

  return (
    <button
      onClick={() => {
        if (!isActive) onSort({ field, direction: 'asc' })
        else if (dir === 'asc') onSort({ field, direction: 'desc' })
        else onSort(undefined)
      }}
      className="flex items-center gap-1 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors"
    >
      {label}
      {!isActive && <ArrowUpDown className="h-3 w-3 opacity-40" />}
      {dir === 'asc' && <ArrowUp className="h-3 w-3" />}
      {dir === 'desc' && <ArrowDown className="h-3 w-3" />}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrdersDataTableProps {
  orders: OrderWithRelations[]
  sort?: SortConfig
  onSort: (s: SortConfig | undefined) => void
  onRowClick: (order: OrderWithRelations) => void
  onEdit: (order: OrderWithRelations) => void
}

export function OrdersDataTable({ orders, sort, onSort, onRowClick, onEdit }: OrdersDataTableProps) {
  const [columnResizeMode] = useState<ColumnResizeMode>('onChange')

  const columns = useMemo<ColumnDef<OrderWithRelations>[]>(() => [
    {
      id: 'order_number',
      header: () => <SortableHeader label="Order #" field="order_number" sort={sort} onSort={onSort} />,
      accessorFn: (row) => row.order_number ?? 'Draft',
      size: 100,
      minSize: 70,
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold text-foreground">{getValue() as string}</span>
      ),
    },
    {
      id: 'status',
      header: () => <span className="text-xs font-semibold text-foreground/60">Status</span>,
      accessorFn: (row) => row.status,
      size: 100,
      minSize: 80,
      cell: ({ row }) => <StatusBadge status={row.original.status} type="order" />,
    },
    {
      id: 'vehicle',
      header: () => <span className="text-xs font-semibold text-foreground/60">Vehicle</span>,
      accessorFn: (row) => {
        const parts: string[] = []
        if (row.vehicle_year) parts.push(String(row.vehicle_year))
        if (row.vehicle_make) parts.push(row.vehicle_make)
        if (row.vehicle_model) parts.push(row.vehicle_model)
        return parts.join(' ') || 'No vehicle info'
      },
      size: 180,
      minSize: 100,
      cell: ({ getValue }) => (
        <span className="text-sm text-foreground truncate block">{getValue() as string}</span>
      ),
    },
    {
      id: 'route',
      header: () => <span className="text-xs font-semibold text-foreground/60">Route</span>,
      size: 200,
      minSize: 120,
      cell: ({ row }) => {
        const o = row.original
        const from = [o.pickup_city, o.pickup_state].filter(Boolean).join(', ')
        const to = [o.delivery_city, o.delivery_state].filter(Boolean).join(', ')
        return (
          <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
            <span className="truncate">{from || 'TBD'}</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{to || 'TBD'}</span>
          </div>
        )
      },
    },
    {
      id: 'broker',
      header: () => <span className="text-xs font-semibold text-foreground/60">Broker</span>,
      accessorFn: (row) => row.broker?.name ?? '',
      size: 130,
      minSize: 70,
      cell: ({ getValue }) => (
        <span className="text-sm truncate block" style={{ color: 'var(--foreground)', opacity: 0.7 }}>{(getValue() as string) || '--'}</span>
      ),
    },
    {
      id: 'pay_type',
      header: () => <span className="text-xs font-semibold text-foreground/60">Pay</span>,
      accessorFn: (row) => row.payment_type ?? '',
      size: 65,
      minSize: 45,
      cell: ({ getValue }) => (
        <span className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>{(getValue() as string) || '--'}</span>
      ),
    },
    {
      id: 'dates',
      header: () => <span className="text-xs font-semibold text-foreground/60">Dates</span>,
      size: 130,
      minSize: 90,
      cell: ({ row }) => {
        const o = row.original
        return (
          <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span>{formatShortDate(o.pickup_date)}</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
            <span>{formatShortDate(o.delivery_date)}</span>
          </div>
        )
      },
    },
    {
      id: 'driver',
      header: () => <span className="text-xs font-semibold text-foreground/60">Driver</span>,
      accessorFn: (row) => row.driver ? `${row.driver.first_name} ${row.driver.last_name}` : '',
      size: 120,
      minSize: 70,
      cell: ({ getValue }) => (
        <span className="text-sm truncate block" style={{ color: 'var(--foreground)', opacity: 0.7 }}>{(getValue() as string) || '--'}</span>
      ),
    },
    {
      id: 'revenue',
      header: () => (
        <div className="text-right w-full">
          <SortableHeader label="Revenue" field="revenue" sort={sort} onSort={onSort} />
        </div>
      ),
      accessorFn: (row) => parseFloat(row.revenue),
      size: 90,
      minSize: 70,
      cell: ({ row }) => {
        const o = row.original
        const rev = parseFloat(o.revenue)
        return (
          <div className="text-right">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {rev > 0 ? formatCurrency(rev) : '--'}
            </span>
            {o.payment_type === 'SPLIT' && o.cod_amount && o.billing_amount && (
              <div className="text-xs text-muted-foreground tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">COD {formatCurrency(o.cod_amount)}</span>
                {' / '}
                <span className="text-brand">Bill {formatCurrency(o.billing_amount)}</span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: () => null,
      size: 80,
      minSize: 60,
      enableResizing: false,
      cell: ({ row }) => (
        <ActionsCell order={row.original} onEdit={onEdit} onRowClick={onRowClick} />
      ),
    },
  ], [sort, onSort, onEdit, onRowClick])

  const table = useReactTable({
    data: orders,
    columns,
    columnResizeMode,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      minSize: 40,
      size: 100,
    },
  })

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table
        className="w-full"
        style={{ minWidth: table.getCenterTotalSize() }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-muted/30 border-b border-border">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="relative px-3 py-2 text-left select-none"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                  {/* Resize handle */}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={`absolute right-0 top-1 bottom-1 w-[3px] rounded-full cursor-col-resize select-none touch-none transition-colors ${
                        header.column.getIsResizing()
                          ? 'bg-brand'
                          : 'bg-border/60 hover:bg-brand/60'
                      }`}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick(row.original)}
              className="border-b border-border/50 transition-colors hover:bg-muted/20 cursor-pointer"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-3 py-2"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
