'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { ExpenseBreakdownItem } from '@/lib/financial/kpi-calculations'

const COLORS = [
  '#fb7232', // orange (driver pay)
  '#f43f5e', // rose (broker fees)
  '#8b5cf6', // violet (carrier pay)
  '#3b82f6', // blue (fuel)
  '#10b981', // emerald (tolls)
  '#f59e0b', // amber (repairs)
  '#6366f1', // indigo (lodging)
  '#94a3b8', // slate (misc)
]

interface ExpenseBreakdownChartProps {
  data: ExpenseBreakdownItem[]
  totalExpenses: number
}

export function ExpenseBreakdownChart({ data, totalExpenses }: ExpenseBreakdownChartProps) {
  const hasData = data.length > 0 && totalExpenses > 0

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4 h-full">
      <h3 className="text-base font-semibold text-foreground mb-3">Expense Breakdown</h3>

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No expense data</p>
        </div>
      ) : (
        <>
          <div className="h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="amount"
                  nameKey="label"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                ${totalExpenses >= 1000 ? `${(totalExpenses / 1000).toFixed(1)}k` : totalExpenses.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {data.slice(0, 6).map((item, i) => (
              <div key={item.category} className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{item.label}</span>
                <span className="text-[11px] font-medium tabular-nums text-foreground ml-auto shrink-0">
                  {item.percentage}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
