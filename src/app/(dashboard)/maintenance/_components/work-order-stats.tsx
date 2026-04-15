import { Wrench, CheckCircle2, Archive, DollarSign } from 'lucide-react'

interface WorkOrderStatsProps {
  openCount: number
  completedThisMonth: number
  closedThisMonth: number
  totalSpendThisMonth: string
}

export function WorkOrderStats({
  openCount,
  completedThisMonth,
  closedThisMonth,
  totalSpendThisMonth,
}: WorkOrderStatsProps) {
  const spend = parseFloat(totalSpendThisMonth)
  const spendFormatted = isNaN(spend)
    ? '$0'
    : spend >= 10000
      ? `$${(spend / 1000).toFixed(1)}k`
      : spend.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="widget-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Open</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{openCount}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2">
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">New + scheduled + in progress</p>
      </div>

      <div className="widget-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Completed</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{completedThisMonth}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">This month</p>
      </div>

      <div className="widget-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Closed</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{closedThisMonth}</p>
          </div>
          <div className="rounded-lg bg-zinc-100 p-2">
            <Archive className="h-4 w-4 text-zinc-500" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">This month</p>
      </div>

      <div className="widget-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Total Spend</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{spendFormatted}</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-2">
            <DollarSign className="h-4 w-4 text-orange-500" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Closed WOs this month</p>
      </div>
    </div>
  )
}
