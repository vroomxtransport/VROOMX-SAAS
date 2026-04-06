'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { BrokerReceivable } from '@/lib/queries/receivables'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/types'
import type { PaymentStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyIdButton } from '@/components/shared/copy-id-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BatchActions } from './batch-actions'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { CsvExportButton } from '@/components/shared/csv-export-button'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Determine the worst aging bucket for a broker based on oldest unpaid invoice
function getBrokerAgingBucket(broker: BrokerReceivable, now: number): string {
  if (!broker.oldestUnpaid) return 'current'
  const days = Math.floor(
    (now - new Date(broker.oldestUnpaid).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (days <= 0) return 'current'
  if (days <= 30) return '1_30'
  if (days <= 60) return '31_60'
  if (days <= 90) return '61_90'
  return '90_plus'
}

const AGING_FILTER_OPTIONS = [
  { value: 'current', label: 'Current (0 days)' },
  { value: '1_30', label: '1-30 Days' },
  { value: '31_60', label: '31-60 Days' },
  { value: '61_90', label: '61-90 Days' },
  { value: '90_plus', label: '90+ Days' },
]

const SORT_OPTIONS = [
  { value: 'amount_desc', label: 'Amount (High to Low)' },
  { value: 'amount_asc', label: 'Amount (Low to High)' },
  { value: 'broker_asc', label: 'Broker (A-Z)' },
  { value: 'broker_desc', label: 'Broker (Z-A)' },
  { value: 'days_outstanding_desc', label: 'Days Outstanding (Most)' },
  { value: 'days_outstanding_asc', label: 'Days Outstanding (Least)' },
]

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'search',
    label: 'Search',
    type: 'search',
    placeholder: 'Search broker name...',
  },
  {
    key: 'aging',
    label: 'Aging Bucket',
    type: 'multi-select',
    options: AGING_FILTER_OPTIONS,
  },
  {
    key: 'sort',
    label: 'Sort By',
    type: 'select',
    options: SORT_OPTIONS,
  },
]

interface ReceivablesTableProps {
  receivables: BrokerReceivable[]
}

export function ReceivablesTable({ receivables }: ReceivablesTableProps) {
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  )
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(
    new Set()
  )
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | string[] | DateRange | undefined>
  >({})

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      setActiveFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Apply filters and sorting
  const filteredReceivables = useMemo(() => {
    const now = new Date().getTime()
    let result = [...receivables]

    // Search filter
    const search = activeFilters.search as string | undefined
    if (search) {
      const term = search.toLowerCase()
      result = result.filter((b) =>
        b.brokerName.toLowerCase().includes(term)
      )
    }

    // Aging bucket filter
    const agingBuckets = activeFilters.aging as string[] | undefined
    if (agingBuckets && agingBuckets.length > 0) {
      result = result.filter((b) =>
        agingBuckets.includes(getBrokerAgingBucket(b, now))
      )
    }

    // Sort
    const sortValue = activeFilters.sort as string | undefined
    if (sortValue) {
      const isAsc = sortValue.endsWith('_asc')
      const dir = isAsc ? 1 : -1
      const sortKey = sortValue.replace(/_asc$/, '').replace(/_desc$/, '')

      result.sort((a, b) => {
        if (sortKey === 'amount') {
          return (a.totalOwed - b.totalOwed) * dir
        }
        if (sortKey === 'broker') {
          return a.brokerName.localeCompare(b.brokerName) * dir
        }
        if (sortKey === 'days_outstanding') {
          // Compare by oldest unpaid date directly (older date = more days outstanding)
          const dateA = a.oldestUnpaid ? new Date(a.oldestUnpaid).getTime() : Infinity
          const dateB = b.oldestUnpaid ? new Date(b.oldestUnpaid).getTime() : Infinity
          // Older date = smaller timestamp = more days outstanding
          return (dateA - dateB) * dir
        }
        return 0
      })
    }

    return result
  }, [receivables, activeFilters])

  const toggleBrokerExpand = useCallback((brokerId: string) => {
    setExpandedBrokers((prev) => {
      const next = new Set(prev)
      if (next.has(brokerId)) {
        next.delete(brokerId)
      } else {
        next.add(brokerId)
      }
      return next
    })
  }, [])

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }, [])

  const toggleBrokerSelection = useCallback(
    (broker: BrokerReceivable) => {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev)
        const orderIds = broker.orders.map((o) => o.id)
        const allSelected = orderIds.every((id) => prev.has(id))

        if (allSelected) {
          orderIds.forEach((id) => next.delete(id))
        } else {
          orderIds.forEach((id) => next.add(id))
        }
        return next
      })
    },
    []
  )

  const toggleSelectAll = useCallback(() => {
    setSelectedOrderIds((prev) => {
      const allOrderIds = filteredReceivables.flatMap((b) =>
        b.orders.map((o) => o.id)
      )
      const allSelected = allOrderIds.every((id) => prev.has(id))

      if (allSelected) {
        return new Set()
      }
      return new Set(allOrderIds)
    })
  }, [filteredReceivables])

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set())
  }, [])

  const handleCsvExport = useCallback(async (): Promise<Record<string, unknown>[]> => {
    return filteredReceivables.map((b) => ({
      'Broker': b.brokerName,
      'Total Owed': b.totalOwed,
      'Invoice Count': b.invoiceCount,
      'Oldest Unpaid': b.oldestUnpaid ?? '',
      'Paid This Month': b.paidThisMonth,
      'Overdue Amount': b.overdueAmount,
    }))
  }, [filteredReceivables])

  const allOrderIds = filteredReceivables.flatMap((b) => b.orders.map((o) => o.id))
  const allSelected =
    allOrderIds.length > 0 && allOrderIds.every((id) => selectedOrderIds.has(id))
  const someSelected = selectedOrderIds.size > 0

  if (receivables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-surface py-8 text-center">
        <Package className="mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-muted-foreground">
          No outstanding receivables
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          All invoiced orders have been paid
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={filteredReceivables.length}
          />
        </div>
        <CsvExportButton
          filename="receivables"
          headers={['Broker', 'Total Owed', 'Invoice Count', 'Oldest Unpaid', 'Paid This Month', 'Overdue Amount']}
          fetchData={handleCsvExport}
        />
      </div>

      {/* Batch Actions Toolbar */}
      {someSelected && (
        <BatchActions
          selectedOrderIds={Array.from(selectedOrderIds)}
          onClear={clearSelection}
        />
      )}

      <div className="rounded-lg border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all orders"
                />
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Broker</TableHead>
              <TableHead className="text-right">Total Owed</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
              <TableHead>Oldest Unpaid</TableHead>
              <TableHead className="text-right">Paid This Month</TableHead>
              <TableHead className="text-right">Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceivables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No receivables match your filters
                </TableCell>
              </TableRow>
            ) : (
              filteredReceivables.map((broker) => {
                const isExpanded = expandedBrokers.has(broker.brokerId)
                const brokerOrderIds = broker.orders.map((o) => o.id)
                const allBrokerSelected = brokerOrderIds.every((id) =>
                  selectedOrderIds.has(id)
                )
                const someBrokerSelected =
                  brokerOrderIds.some((id) => selectedOrderIds.has(id)) &&
                  !allBrokerSelected

                return (
                  <BrokerRow
                    key={broker.brokerId}
                    broker={broker}
                    isExpanded={isExpanded}
                    allSelected={allBrokerSelected}
                    indeterminate={someBrokerSelected}
                    onToggleExpand={() => toggleBrokerExpand(broker.brokerId)}
                    onToggleBrokerSelect={() => toggleBrokerSelection(broker)}
                    selectedOrderIds={selectedOrderIds}
                    onToggleOrderSelect={toggleOrderSelection}
                  />
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Broker Row (with expandable order detail)
// ============================================================================

interface BrokerRowProps {
  broker: BrokerReceivable
  isExpanded: boolean
  allSelected: boolean
  indeterminate: boolean
  onToggleExpand: () => void
  onToggleBrokerSelect: () => void
  selectedOrderIds: Set<string>
  onToggleOrderSelect: (orderId: string) => void
}

function BrokerRow({
  broker,
  isExpanded,
  allSelected,
  indeterminate,
  onToggleExpand,
  onToggleBrokerSelect,
  selectedOrderIds,
  onToggleOrderSelect,
}: BrokerRowProps) {
  return (
    <>
      {/* Broker summary row */}
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Checkbox
            checked={indeterminate ? 'indeterminate' : allSelected}
            onCheckedChange={onToggleBrokerSelect}
            aria-label={`Select all orders for ${broker.brokerName}`}
          />
        </TableCell>
        <TableCell>
          <button
            onClick={onToggleExpand}
            className="rounded p-0.5 hover:bg-muted"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </TableCell>
        <TableCell>
          <Link
            href={`/brokers/${broker.brokerId}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {broker.brokerName}
          </Link>
        </TableCell>
        <TableCell className="text-right font-semibold">
          {formatCurrency(broker.totalOwed)}
        </TableCell>
        <TableCell className="text-center">{broker.invoiceCount}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {formatDate(broker.oldestUnpaid)}
        </TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">
          {formatCurrency(broker.paidThisMonth)}
        </TableCell>
        <TableCell
          className={cn(
            'text-right font-medium',
            broker.overdueAmount > 0 ? 'text-red-600' : 'text-muted-foreground'
          )}
        >
          {formatCurrency(broker.overdueAmount)}
        </TableCell>
      </TableRow>

      {/* Expanded order rows */}
      {isExpanded &&
        broker.orders.map((order) => (
          <TableRow key={order.id} className="bg-muted/30">
            <TableCell>
              <Checkbox
                checked={selectedOrderIds.has(order.id)}
                onCheckedChange={() => onToggleOrderSelect(order.id)}
                aria-label={`Select order ${order.orderNumber ?? order.id}`}
              />
            </TableCell>
            <TableCell />
            <TableCell className="pl-12 text-sm">
              <div className="group flex items-center gap-1">
                <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                  {order.orderNumber ?? order.id.slice(0, 8)}
                </Link>
                <CopyIdButton value={order.orderNumber ?? order.id} className="opacity-0 group-hover:opacity-100" />
              </div>
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatCurrency(order.carrierPay)}
            </TableCell>
            <TableCell className="text-center text-sm">
              {formatCurrency(order.amountPaid)} paid
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(order.invoiceDate)}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatCurrency(order.carrierPay - order.amountPaid)}
            </TableCell>
            <TableCell className="text-right">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  PAYMENT_STATUS_COLORS[order.paymentStatus as PaymentStatus] ??
                    ''
                )}
              >
                {PAYMENT_STATUS_LABELS[order.paymentStatus as PaymentStatus] ??
                  order.paymentStatus}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
    </>
  )
}
