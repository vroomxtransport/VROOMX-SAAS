import type { WorkOrderDetail } from '@/lib/queries/work-orders'

interface WorkOrderAccountingPanelProps {
  wo: WorkOrderDetail
}

function fmt(value: string | null | undefined): string {
  const n = parseFloat(value ?? '0')
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function WorkOrderAccountingPanel({ wo }: WorkOrderAccountingPanelProps) {
  const grandTotal = parseFloat(wo.grand_total ?? '0')
  const hasAmount = grandTotal > 0

  return (
    <div className="widget-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Accounting</h2>
      </div>

      <div className="divide-y divide-border">
        {/* Invoice number */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WO #</span>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {wo.wo_number != null ? `${wo.wo_number}` : '—'}
          </span>
        </div>

        {/* Total Labor */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Labor</span>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {fmt(wo.total_labor)}
          </span>
        </div>

        {/* Total Parts */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">Parts</span>
          <span className="font-mono text-sm tabular-nums text-foreground">
            {fmt(wo.total_parts)}
          </span>
        </div>

        {/* Grand Total — visually accented */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'color-mix(in srgb, var(--brand-action, #fb7232) 5%, transparent)' }}
        >
          <span className="text-sm font-bold text-foreground">Grand Total</span>
          <span
            className={`font-mono text-base font-bold tabular-nums ${
              hasAmount ? 'text-[var(--brand-action,#fb7232)]' : 'text-foreground'
            }`}
          >
            {fmt(wo.grand_total)}
          </span>
        </div>
      </div>
    </div>
  )
}
