'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchRecentPayments } from '@/lib/queries/receivables'
import { format } from 'date-fns'
import { CreditCard } from 'lucide-react'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPaymentDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-emerald-500" />
          Recent Payments
        </span>
        <div className="rounded-lg p-1.5 bg-emerald-50">
          <CreditCard className="h-4 w-4 text-emerald-500" />
        </div>
      </div>
      <div className="flex-1 space-y-2 mt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-3">
            <div className="space-y-1.5">
              <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-4 w-14 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecentPayments() {
  const supabase = createClient()

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'recent-payments'],
    queryFn: () => fetchRecentPayments(supabase),
    staleTime: 30_000,
  })

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-emerald-500" />
          Recent Payments
        </span>
        <div className="rounded-lg p-1.5 bg-emerald-50">
          <CreditCard className="h-4 w-4 text-emerald-500" />
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <CreditCard className="h-8 w-8 opacity-40" />
          <p className="text-sm">No recent payments</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden space-y-1 mt-1">
          {payments.map((payment, idx) => (
            <div
              key={`${payment.orderNumber}-${idx}`}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {payment.orderNumber}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPaymentDate(payment.paymentDate)}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-emerald-600 shrink-0 ml-3">
                +{fmt(payment.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
