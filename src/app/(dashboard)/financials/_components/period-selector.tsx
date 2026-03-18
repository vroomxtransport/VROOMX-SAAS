'use client'

import { motion } from 'framer-motion'
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
    <div className="rounded-xl border border-border-subtle bg-muted/50 p-1 flex">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors z-10',
            value === p.value
              ? 'text-white'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {value === p.value && (
            <motion.span
              layoutId="period-indicator"
              className="absolute inset-0 bg-brand rounded-lg"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative z-10">{p.label}</span>
        </button>
      ))}
    </div>
  )
}
