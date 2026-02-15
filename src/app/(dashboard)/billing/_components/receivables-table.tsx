'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { BrokerReceivable } from '@/lib/queries/receivables'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '@/types'
import type { PaymentStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
      const allOrderIds = receivables.flatMap((b) =>
        b.orders.map((o) => o.id)
      )
      const allSelected = allOrderIds.every((id) => prev.has(id))

      if (allSelected) {
        return new Set()
      }
      return new Set(allOrderIds)
    })
  }, [receivables])

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set())
  }, [])

  const allOrderIds = receivables.flatMap((b) => b.orders.map((o) => o.id))
  const allSelected =
    allOrderIds.length > 0 && allOrderIds.every((id) => selectedOrderIds.has(id))
  const someSelected = selectedOrderIds.size > 0

  if (receivables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-8 text-center">
        <Package className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">
          No outstanding receivables
        </p>
        <p className="mt-1 text-xs text-gray-400">
          All invoiced orders have been paid
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Batch Actions Toolbar */}
      {someSelected && (
        <BatchActions
          selectedOrderIds={Array.from(selectedOrderIds)}
          onClear={clearSelection}
        />
      )}

      <div className="rounded-lg border bg-white">
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
            {receivables.map((broker) => {
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
            })}
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
      <TableRow className="hover:bg-gray-50">
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
            className="rounded p-0.5 hover:bg-gray-200"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
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
        <TableCell className="text-sm text-gray-600">
          {formatDate(broker.oldestUnpaid)}
        </TableCell>
        <TableCell className="text-right text-sm text-gray-600">
          {formatCurrency(broker.paidThisMonth)}
        </TableCell>
        <TableCell
          className={cn(
            'text-right font-medium',
            broker.overdueAmount > 0 ? 'text-red-600' : 'text-gray-600'
          )}
        >
          {formatCurrency(broker.overdueAmount)}
        </TableCell>
      </TableRow>

      {/* Expanded order rows */}
      {isExpanded &&
        broker.orders.map((order) => (
          <TableRow key={order.id} className="bg-gray-50/60">
            <TableCell>
              <Checkbox
                checked={selectedOrderIds.has(order.id)}
                onCheckedChange={() => onToggleOrderSelect(order.id)}
                aria-label={`Select order ${order.orderNumber ?? order.id}`}
              />
            </TableCell>
            <TableCell />
            <TableCell className="pl-12 text-sm text-gray-600">
              {order.orderNumber ?? order.id.slice(0, 8)}
            </TableCell>
            <TableCell className="text-right text-sm">
              {formatCurrency(order.carrierPay)}
            </TableCell>
            <TableCell className="text-center text-sm">
              {formatCurrency(order.amountPaid)} paid
            </TableCell>
            <TableCell className="text-sm text-gray-600">
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
