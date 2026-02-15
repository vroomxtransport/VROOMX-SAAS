import { cn } from '@/lib/utils'
import type { PaymentStatusBreakdown } from '@/lib/queries/receivables'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unpaid: { label: 'Unpaid', color: 'text-red-600', bg: 'bg-red-500/10' },
  invoiced: { label: 'Invoiced', color: 'text-amber-600', bg: 'bg-amber-500/10' },
  partially_paid: { label: 'Partially Paid', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  paid: { label: 'Paid', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
}

interface PaymentStatusCardsProps {
  data: PaymentStatusBreakdown[]
}

export function PaymentStatusCards({ data = [] }: PaymentStatusCardsProps) {
  // Ensure all statuses are represented
  const allStatuses = ['unpaid', 'invoiced', 'partially_paid', 'paid']
  const statusMap = new Map(data.map((d) => [d.status, d]))

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Payment Status</h3>
      <div className="space-y-2.5">
        {allStatuses.map((status) => {
          const config = STATUS_CONFIG[status] ?? { label: status, color: 'text-muted-foreground', bg: 'bg-muted' }
          const entry = statusMap.get(status)
          const count = entry?.count ?? 0
          const amount = entry?.amount ?? 0

          return (
            <div
              key={status}
              className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{count} orders</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                ${amount.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
