'use client'

import { useState, useCallback, useMemo } from 'react'
import { usePayrollPeriods, useDispatchersWithPayConfig } from '@/hooks/use-dispatcher-payroll'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { EmptyState } from '@/components/shared/empty-state'
import { Pagination } from '@/components/shared/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Banknote,
  Plus,
  Check,
  DollarSign,
  Trash2,
  Eye,
} from 'lucide-react'
import {
  PAYROLL_PERIOD_STATUS_LABELS,
  PAYROLL_PERIOD_STATUS_COLORS,
  DISPATCHER_PAY_TYPE_LABELS,
} from '@/types'
import type { PayrollPeriodStatus, DispatcherPayType } from '@/types'
import type { DispatcherPayrollPeriod } from '@/types/database'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'
import { PayrollGenerateDrawer } from './payroll-generate-drawer'
import { PayrollPeriodDetailDrawer } from './payroll-period-detail-drawer'
import {
  approvePayrollPeriod,
  markPayrollPeriodPaid,
  deletePayrollPeriod,
} from '@/app/actions/dispatcher-payroll'
import { useQueryClient } from '@tanstack/react-query'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'approved', label: 'Approved', color: 'bg-blue-100 text-blue-700' },
  { value: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
]

const FILTER_CONFIG: EnhancedFilterConfig[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'status-pills',
    options: STATUS_OPTIONS,
  },
]

export function PayrollPeriodList() {
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [detailPeriod, setDetailPeriod] = useState<DispatcherPayrollPeriod | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const queryClient = useQueryClient()
  const { data: dispatchers } = useDispatchersWithPayConfig()

  const { data, isLoading } = usePayrollPeriods({
    status: statusFilter,
    page,
    pageSize: 20,
  })

  const dispatcherMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of dispatchers ?? []) {
      map.set(d.user_id, d.full_name || d.email || d.user_id.substring(0, 8))
    }
    return map
  }, [dispatchers])

  const activeFilters = useMemo(() => {
    const filters: Record<string, string | string[] | DateRange | undefined> = {}
    if (statusFilter) filters.status = statusFilter
    return filters
  }, [statusFilter])

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      if (key === 'status') {
        setStatusFilter(value as string | undefined)
        setPage(0)
      }
    },
    []
  )

  const handleApprove = useCallback(async (id: string) => {
    setActionLoading(id)
    const result = await approvePayrollPeriod(id)
    if ('error' in result && result.error) {
      console.error(result.error)
    }
    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    setActionLoading(null)
  }, [queryClient])

  const handleMarkPaid = useCallback(async (id: string) => {
    setActionLoading(id)
    const result = await markPayrollPeriodPaid(id)
    if ('error' in result && result.error) {
      console.error(result.error)
    }
    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    setActionLoading(null)
  }, [queryClient])

  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id)
    const result = await deletePayrollPeriod(id)
    if ('error' in result && result.error) {
      console.error(result.error)
    }
    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    setActionLoading(null)
  }, [queryClient])

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(value || '0'))
  }

  const formatDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-9 w-[300px]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const periods = data?.periods ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={FILTER_CONFIG}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={total}
          />
        </div>
        <Button onClick={() => setGenerateOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Generate Payroll
        </Button>
      </div>

      {periods.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No payroll periods"
          description="Generate your first payroll period to start tracking dispatcher compensation."
          action={{
            label: 'Generate Payroll',
            onClick: () => setGenerateOpen(true),
          }}
        />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Dispatcher</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periods.map((period) => (
                  <tr key={period.id} className="bg-card hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {dispatcherMap.get(period.user_id) ?? period.user_id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(period.period_start)} – {formatDate(period.period_end)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {DISPATCHER_PAY_TYPE_LABELS[period.pay_type as DispatcherPayType]}
                      {period.pay_type === 'performance_revenue' && (
                        <span className="ml-1 text-xs text-muted-foreground/70">
                          ({parseFloat(period.pay_rate)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-foreground">
                      {formatCurrency(period.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground">
                      {period.order_count}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={PAYROLL_PERIOD_STATUS_COLORS[period.status as PayrollPeriodStatus]}
                      >
                        {PAYROLL_PERIOD_STATUS_LABELS[period.status as PayrollPeriodStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDetailPeriod(period)}
                          title="View details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {period.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700"
                              onClick={() => handleApprove(period.id)}
                              disabled={actionLoading === period.id}
                              title="Approve"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(period.id)}
                              disabled={actionLoading === period.id}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {period.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleMarkPaid(period.id)}
                            disabled={actionLoading === period.id}
                            title="Mark as paid"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={20}
                total={total}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <PayrollGenerateDrawer
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        dispatchers={dispatchers ?? []}
      />

      <PayrollPeriodDetailDrawer
        period={detailPeriod}
        open={!!detailPeriod}
        onOpenChange={(open) => !open && setDetailPeriod(null)}
        dispatcherName={detailPeriod ? (dispatcherMap.get(detailPeriod.user_id) ?? '') : ''}
      />
    </div>
  )
}
