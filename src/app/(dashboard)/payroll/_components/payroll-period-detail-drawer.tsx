'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PAYROLL_PERIOD_STATUS_LABELS,
  PAYROLL_PERIOD_STATUS_COLORS,
  DISPATCHER_PAY_TYPE_LABELS,
} from '@/types'
import type { PayrollPeriodStatus, DispatcherPayType } from '@/types'
import type { DispatcherPayrollPeriod } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { fetchPayrollPeriodOrders } from '@/lib/queries/dispatcher-payroll'
import { useQuery } from '@tanstack/react-query'

interface PayrollPeriodDetailDrawerProps {
  period: DispatcherPayrollPeriod | null
  open: boolean
  onOpenChange: (open: boolean) => void
  dispatcherName: string
}

interface PeriodOrder {
  id: string
  order_number: string | null
  revenue: string
  broker_fee: string
  local_fee: string
  status: string
  created_at: string
}

export function PayrollPeriodDetailDrawer({
  period,
  open,
  onOpenChange,
  dispatcherName,
}: PayrollPeriodDetailDrawerProps) {
  const supabase = createClient()
  const isPerformance = period?.pay_type === 'performance_revenue'

  const { data: ordersData, isLoading: loading } = useQuery({
    queryKey: ['payroll-period-orders', period?.id],
    queryFn: () =>
      fetchPayrollPeriodOrders(
        supabase,
        period!.user_id,
        period!.period_start,
        period!.period_end,
      ),
    enabled: !!period && isPerformance,
    staleTime: 30_000,
  })

  const orders = (ordersData ?? []) as PeriodOrder[]

  if (!period) return null

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value || '0') : value
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num)
  }

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Payroll Period Details</SheetTitle>
          <SheetDescription>
            {dispatcherName} — {formatDate(period.period_start)} to {formatDate(period.period_end)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary Card */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className={PAYROLL_PERIOD_STATUS_COLORS[period.status as PayrollPeriodStatus]}
              >
                {PAYROLL_PERIOD_STATUS_LABELS[period.status as PayrollPeriodStatus]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pay Type</span>
              <span className="text-sm font-medium">
                {DISPATCHER_PAY_TYPE_LABELS[period.pay_type as DispatcherPayType]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rate</span>
              <span className="text-sm font-medium">
                {period.pay_type === 'performance_revenue'
                  ? `${parseFloat(period.pay_rate)}%`
                  : formatCurrency(period.pay_rate)}
              </span>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              {period.pay_type === 'fixed_salary' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Salary Amount</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(period.base_amount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Orders Dispatched</span>
                    <span className="text-sm font-medium">{period.order_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Clean Gross</span>
                    <span className="text-sm font-medium">{formatCurrency(period.total_order_revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Commission ({parseFloat(period.pay_rate)}%)</span>
                    <span className="text-lg font-bold text-foreground">{formatCurrency(period.performance_amount)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-bold">Total Pay</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatCurrency(period.total_amount)}
                </span>
              </div>
            </div>

            {period.approved_at && (
              <div className="text-xs text-muted-foreground pt-1">
                Approved: {new Date(period.approved_at).toLocaleString()}
              </div>
            )}
            {period.paid_at && (
              <div className="text-xs text-muted-foreground">
                Paid: {new Date(period.paid_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Order Breakdown (for performance revenue only) */}
          {period.pay_type === 'performance_revenue' && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Order Breakdown</h4>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders found for this period.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Order</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Revenue</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Clean Gross</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.map((order) => {
                        const revenue = parseFloat(order.revenue || '0')
                        const brokerFee = parseFloat(order.broker_fee || '0')
                        const localFee = parseFloat(order.local_fee || '0')
                        const cleanGross = revenue - brokerFee - localFee
                        const rate = parseFloat(period.pay_rate)
                        const commission = cleanGross * (rate / 100)

                        return (
                          <tr key={order.id} className="bg-card hover:bg-muted/30">
                            <td className="px-3 py-2 font-medium">
                              {order.order_number || order.id.substring(0, 8)}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {formatCurrency(revenue)}
                            </td>
                            <td className="px-3 py-2 text-right text-muted-foreground">
                              {formatCurrency(cleanGross)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-emerald-600">
                              {formatCurrency(commission)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {period.notes && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">Notes</h4>
              <p className="text-sm text-muted-foreground">{period.notes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
