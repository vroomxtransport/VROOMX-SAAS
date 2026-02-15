'use client'

import { cn } from '@/lib/utils'
import type { FinancialPeriod } from '@/lib/queries/financials'

const PERIODS: { value: FinancialPeriod; label: string }[] = [
  { value: 'mtd', label: 'MTD' },
  { value: 'qtd', label: 'QTD' },
  { value: 'ytd', label: 'YTD' },
  { value: 'last30', label: '30d' },
  { value: 'last90', label: '90d' },
]

interface PeriodSelectorProps {
  value: FinancialPeriod
  onChange: (period: FinancialPeriod) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            value === p.value
              ? 'bg-surface shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
