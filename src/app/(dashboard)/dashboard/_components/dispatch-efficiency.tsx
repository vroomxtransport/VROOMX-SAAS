'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchDispatcherPerformance } from '@/lib/queries/dispatcher-performance'
import { fetchOTDMetrics } from '@/lib/queries/on-time-analytics'
import { cn } from '@/lib/utils'
import { Gauge, Clock, CheckCircle2, Inbox } from 'lucide-react'

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  )
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'bg-emerald-500'
  if (rate >= 80) return 'bg-amber-500'
  return 'bg-red-500'
}

function rateBadgeStyles(rate: number): string {
  if (rate >= 90) return 'bg-emerald-50 text-emerald-700'
  if (rate >= 80) return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function SkeletonRow() {
  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-12 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
    </div>
  )
}

export function DispatchEfficiency() {
  const supabase = createClient()

  const { data: dispatchers, isLoading: loadingDispatchers } = useQuery({
    queryKey: ['dashboard', 'dispatch-efficiency', 'dispatchers'],
    queryFn: () => fetchDispatcherPerformance(supabase),
    staleTime: 30_000,
  })

  const { data: otd, isLoading: loadingOTD } = useQuery({
    queryKey: ['dashboard', 'dispatch-efficiency', 'otd'],
    queryFn: () => fetchOTDMetrics(supabase),
    staleTime: 30_000,
  })

  const isLoading = loadingDispatchers || loadingOTD

  // Aggregate dispatcher metrics
  const totalOrders = dispatchers?.reduce((sum, d) => sum + d.total_orders, 0) ?? 0
  const completedOrders = dispatchers?.reduce((sum, d) => sum + d.completed_orders, 0) ?? 0
  const completionRate = totalOrders > 0
    ? Math.round((completedOrders / totalOrders) * 100)
    : 0

  const onTimeRate = otd?.onTimeRate ?? 0
  const isEmpty = !isLoading && totalOrders === 0 && (otd?.totalDelivered ?? 0) === 0

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Dispatch Efficiency
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          All Time
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 divide-y divide-border-subtle">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Inbox className="h-7 w-7 opacity-40" />
          <p className="text-sm">No dispatch data yet</p>
        </div>
      ) : (
        <div className="flex-1 divide-y divide-border-subtle">
          {/* Row 1: Dispatched orders */}
          <div className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Gauge className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Dispatched</p>
              <p className="text-lg font-semibold tabular-nums text-foreground leading-tight">
                {totalOrders.toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              {completedOrders} completed
            </span>
          </div>

          {/* Row 2: On-Time Rate */}
          <div className="space-y-2 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <Clock className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">On-Time Rate</p>
              </div>
              <span className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums',
                rateBadgeStyles(onTimeRate)
              )}>
                {onTimeRate.toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={onTimeRate} color={rateColor(onTimeRate)} />
          </div>

          {/* Row 3: Completion Rate */}
          <div className="space-y-2 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50">
                <CheckCircle2 className="h-4 w-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {completedOrders}/{totalOrders}
              </span>
            </div>
            <ProgressBar value={completionRate} color="bg-violet-500" />
          </div>
        </div>
      )}
    </div>
  )
}
