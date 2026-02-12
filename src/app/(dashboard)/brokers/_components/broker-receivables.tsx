'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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
import { DollarSign, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from '@/types'
import type { PaymentStatus } from '@/types'

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

interface BrokerReceivablesProps {
  brokerId: string
}

interface ReceivableOrder {
  id: string
  order_number: string | null
  carrier_pay: string
  amount_paid: string
  payment_status: string
  invoice_date: string | null
}

async function fetchBrokerOrders(
  brokerId: string
): Promise<ReceivableOrder[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, carrier_pay, amount_paid, payment_status, invoice_date')
    .eq('broker_id', brokerId)
    .in('payment_status', ['unpaid', 'invoiced', 'partially_paid'])
    .order('invoice_date', { ascending: true, nullsFirst: false })

  if (error) throw error
  return data ?? []
}

export function BrokerReceivables({ brokerId }: BrokerReceivablesProps) {
  const { data: orders, isPending, isError } = useQuery({
    queryKey: ['broker-receivables', brokerId],
    queryFn: () => fetchBrokerOrders(brokerId),
    enabled: !!brokerId,
    staleTime: 30_000,
  })

  if (isPending) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Receivables</h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Receivables</h2>
        </div>
        <p className="text-sm text-red-600">Failed to load receivables.</p>
      </div>
    )
  }

  const totalOwed = (orders ?? []).reduce((sum, o) => {
    return sum + (parseFloat(o.carrier_pay) - parseFloat(o.amount_paid))
  }, 0)

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">Receivables</h2>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">
            No outstanding receivables for this broker.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">
            {orders.length} outstanding order{orders.length !== 1 ? 's' : ''}{' '}
            totaling{' '}
            <span className="font-semibold text-gray-900">
              {formatCurrency(totalOwed)}
            </span>
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Carrier Pay</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const carrierPay = parseFloat(order.carrier_pay)
                const amountPaid = parseFloat(order.amount_paid)
                const remaining = carrierPay - amountPaid

                return (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {order.order_number ?? order.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(carrierPay)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(amountPaid)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(remaining)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          PAYMENT_STATUS_COLORS[
                            order.payment_status as PaymentStatus
                          ] ?? ''
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[
                          order.payment_status as PaymentStatus
                        ] ?? order.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(order.invoice_date)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  )
}
