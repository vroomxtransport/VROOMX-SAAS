'use client'

import type { ExpenseSummary } from '@/lib/queries/truck-expense-ledger'

interface TruckExpenseBreakdownProps {
  summary: ExpenseSummary | null
}

interface BreakdownRow {
  label: string
  value: number
  color: string
}

const CATEGORY_COLORS: Record<string, string> = {
  Fuel: '#192334',
  Maintenance: '#6366f1',
  Repairs: '#f59e0b',
  Tolls: '#0ea5e9',
  Lodging: '#8b5cf6',
  Insurance: '#10b981',
  'Truck Lease': '#64748b',
  Registration: '#14b8a6',
  Other: '#94a3b8',
}

function buildRows(summary: ExpenseSummary): BreakdownRow[] {
  const rawRows: BreakdownRow[] = [
    { label: 'Fuel', value: summary.fuel, color: CATEGORY_COLORS.Fuel },
    { label: 'Maintenance', value: summary.maintenance, color: CATEGORY_COLORS.Maintenance },
    { label: 'Repairs', value: summary.repairs, color: CATEGORY_COLORS.Repairs },
    { label: 'Tolls', value: summary.tolls, color: CATEGORY_COLORS.Tolls },
    { label: 'Lodging', value: summary.lodging, color: CATEGORY_COLORS.Lodging },
    { label: 'Insurance', value: summary.insurance, color: CATEGORY_COLORS.Insurance },
    { label: 'Truck Lease', value: summary.truck_lease, color: CATEGORY_COLORS['Truck Lease'] },
    { label: 'Registration', value: summary.registration, color: CATEGORY_COLORS.Registration },
    {
      label: 'Other',
      value: summary.fixed_other + summary.other,
      color: CATEGORY_COLORS.Other,
    },
  ]
  return rawRows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value)
}

export function TruckExpenseBreakdown({ summary }: TruckExpenseBreakdownProps) {
  if (!summary || summary.total === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Expense Breakdown
          </h3>
        </div>
        <p className="py-12 text-center text-sm text-muted-foreground">
          No expenses in the selected period
        </p>
      </div>
    )
  }

  const rows = buildRows(summary)
  const max = Math.max(...rows.map((r) => r.value), 1)

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Expense Breakdown
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          ${summary.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total
        </p>
      </div>

      <div className="space-y-2.5">
        {rows.map((row) => {
          const widthPct = (row.value / max) * 100
          const sharePct = summary.total > 0 ? (row.value / summary.total) * 100 : 0
          return (
            <div key={row.label} className="flex items-center gap-3">
              <p className="w-24 text-xs text-muted-foreground truncate">{row.label}</p>
              <div className="relative flex-1 h-6">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: row.color, opacity: 0.85 }}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className="text-[11px] font-medium tabular-nums text-foreground/90">
                    ${row.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              <p className="w-12 text-right text-[11px] tabular-nums text-muted-foreground">
                {sharePct.toFixed(1)}%
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
