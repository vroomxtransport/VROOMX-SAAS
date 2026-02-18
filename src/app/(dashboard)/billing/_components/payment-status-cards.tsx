'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchOrdersByPaymentStatus, type StatusOrder } from '@/lib/queries/receivables'
import type { PaymentStatusBreakdown } from '@/lib/queries/receivables'
import type { PaymentStatus } from '@/types'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  unpaid: { label: 'Unpaid', color: 'text-red-600', bg: 'bg-red-500/10', ring: 'ring-red-500/30' },
  invoiced: { label: 'Invoiced', color: 'text-amber-600', bg: 'bg-amber-500/10', ring: 'ring-amber-500/30' },
  factored: { label: 'Factored', color: 'text-purple-600', bg: 'bg-purple-500/10', ring: 'ring-purple-500/30' },
  partially_paid: { label: 'Partially Paid', color: 'text-blue-600', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' },
  paid: { label: 'Paid', color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' },
}

const ALL_STATUSES: PaymentStatus[] = ['unpaid', 'invoiced', 'factored', 'partially_paid', 'paid']

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface PaymentStatusCardsProps {
  data: PaymentStatusBreakdown[]
}

export function PaymentStatusCards({ data = [] }: PaymentStatusCardsProps) {
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus | null>(null)
  const statusMap = new Map(data.map((d) => [d.status, d]))

  const supabase = createClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders-by-payment-status', selectedStatus],
    queryFn: () => fetchOrdersByPaymentStatus(supabase, selectedStatus!),
    enabled: !!selectedStatus,
    staleTime: 30_000,
  })

  function handleCardClick(status: PaymentStatus) {
    setSelectedStatus((prev) => (prev === status ? null : status))
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Payment Status</h3>
      <div className="space-y-2.5">
        {ALL_STATUSES.map((status) => {
          const config = STATUS_CONFIG[status] ?? { label: status, color: 'text-muted-foreground', bg: 'bg-muted', ring: 'ring-muted' }
          const entry = statusMap.get(status)
          const count = entry?.count ?? 0
          const amount = entry?.amount ?? 0
          const isSelected = selectedStatus === status

          return (
            <button
              key={status}
              type="button"
              onClick={() => handleCardClick(status)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all cursor-pointer',
                isSelected
                  ? `border-transparent ring-2 ${config.ring} ${config.bg}`
                  : 'border-border-subtle hover:bg-muted/50'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{count} orders</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  ${amount.toLocaleString()}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                    isSelected && 'rotate-180'
                  )}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Order list panel */}
      {selectedStatus && (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            {STATUS_CONFIG[selectedStatus]?.label ?? selectedStatus} Orders
          </h4>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !orders?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No orders found.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {order.orderNumber ?? 'No #'}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {order.vehicleName}
                      {order.brokerName ? ` — ${order.brokerName}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(order.carrierPay)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(order.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
