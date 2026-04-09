import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/status-badge'

const PIPELINE_STATUSES = [
  { key: 'new', label: 'New', color: 'bg-blue-500' },
  { key: 'assigned', label: 'Assigned', color: 'bg-amber-500' },
  { key: 'picked_up', label: 'Picked Up', color: 'bg-purple-500' },
  { key: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { key: 'invoiced', label: 'Invoiced', color: 'bg-indigo-500' },
  { key: 'paid', label: 'Paid', color: 'bg-emerald-500' },
] as const

interface RecentOrder {
  orderNumber: string
  vehicle: string
  route: string
  status: string
  revenue: number
}

interface LoadsPipelineProps {
  pipelineCounts: Record<string, number>
  recentOrders: RecentOrder[]
}

export function LoadsPipeline({ pipelineCounts, recentOrders }: LoadsPipelineProps) {
  const total = PIPELINE_STATUSES.reduce((sum, s) => sum + (pipelineCounts[s.key] ?? 0), 0)

  const visibleSegments = PIPELINE_STATUSES.filter((s) => {
    const count = pipelineCounts[s.key] ?? 0
    return total > 0 && (count / total) * 100 > 0
  })

  return (
    <div className="widget-card-primary h-full flex flex-col">
      {/* Header */}
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Loads Pipeline
        </span>
        <span className="rounded-full bg-brand/10 text-brand px-2.5 py-0.5 text-xs font-semibold tabular-nums">
          {total} total
        </span>
      </div>

      {/* Segmented status bar */}
      <div className="h-5 rounded-full overflow-hidden flex gap-0.5">
        {PIPELINE_STATUSES.map((status) => {
          const count = pipelineCounts[status.key] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null

          const visibleIdx = visibleSegments.findIndex((s) => s.key === status.key)
          const isFirst = visibleIdx === 0
          const isLast = visibleIdx === visibleSegments.length - 1

          return (
            <div
              key={status.key}
              className={cn(
                'shine-line transition-all duration-500 flex items-center justify-center group/seg relative cursor-default',
                status.color,
                isFirst && 'rounded-l-full',
                isLast && 'rounded-r-full'
              )}
              style={{ width: `${pct}%` }}
            >
              {pct > 6 && (
                <span className="text-xs font-semibold text-white">{count}</span>
              )}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-foreground/90 px-2 py-1 text-[10px] font-medium text-background opacity-0 transition-opacity group-hover/seg:opacity-100 pointer-events-none z-10">
                {status.label}: {count} ({Math.round(pct)}%)
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-1.5 mt-3">
        {PIPELINE_STATUSES.map((status) => (
          <div
            key={status.key}
            className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs"
          >
            <span className={cn('h-2 w-2 rounded-full shrink-0', status.color)} />
            <span className="text-muted-foreground">
              {status.label} ({pipelineCounts[status.key] ?? 0})
            </span>
          </div>
        ))}
      </div>

      {/* Recent orders mini-table */}
      <div className="flex-1 min-h-0 overflow-hidden mt-4">
        <div className="border-l-2 border-brand/50 pl-3 mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Orders</h4>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No orders yet. Create your first order to see it here.</p>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="pb-2 text-left text-xs font-medium text-foreground/80">Order #</th>
                  <th className="pb-2 text-left text-xs font-medium text-foreground/80 hidden sm:table-cell">Vehicle</th>
                  <th className="pb-2 text-left text-xs font-medium text-foreground/80 hidden md:table-cell">Route</th>
                  <th className="pb-2 text-left text-xs font-medium text-foreground/80">Status</th>
                  <th className="pb-2 text-right text-xs font-medium text-foreground/80">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {recentOrders.map((order) => (
                  <tr
                    key={order.orderNumber}
                    className="group transition-colors hover:bg-[var(--accent-blue-bg)]"
                  >
                    <td className="py-2 font-semibold text-foreground group-hover:text-brand transition-colors">
                      {order.orderNumber}
                    </td>
                    <td className="py-2 text-muted-foreground hidden sm:table-cell">{order.vehicle}</td>
                    <td className="py-2 text-muted-foreground hidden md:table-cell">{order.route}</td>
                    <td className="py-2">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums text-foreground">
                      ${order.revenue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
