'use client'

import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChartIncreaseIcon, ChartDecreaseIcon, MinusSignIcon } from '@hugeicons/core-free-icons'

export interface KPIDeltaProps {
  current: number
  previous: number
  format?: 'currency' | 'percent' | 'number'
  /** If true, a decrease is good (e.g. costs, operating ratio) */
  invertColor?: boolean
  className?: string
}

/**
 * Renders a compact period-over-period delta badge.
 * Shows +12.5% / -8.3% with a trending icon, coloured green for
 * improvement and red for decline (respects invertColor).
 * Renders "—" in muted text when previous is 0 or delta is 0.
 */
export function KPIDelta({ current, previous, invertColor = false, className }: KPIDeltaProps) {
  // Cannot compute a meaningful delta without a prior-period value
  if (previous === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-border-subtle bg-muted/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground', className)}>
        <HugeiconsIcon icon={MinusSignIcon} size={11} className="shrink-0" />
        <span></span>
      </span>
    )
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100
  const isZero = Math.abs(pct) < 0.05

  if (isZero) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full border border-border-subtle bg-muted/50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground', className)}>
        <HugeiconsIcon icon={MinusSignIcon} size={11} className="shrink-0" />
        <span>0%</span>
      </span>
    )
  }

  const isPositiveChange = pct > 0
  // For inverted metrics (costs), positive change is bad
  const isGood = invertColor ? !isPositiveChange : isPositiveChange
  const sign = isPositiveChange ? '+' : ''
  const label = `${sign}${pct.toFixed(1)}%`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        isGood
          ? 'text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300',
        className,
      )}
    >
      {isPositiveChange
        ? <HugeiconsIcon icon={ChartIncreaseIcon} size={11} className="shrink-0" />
        : <HugeiconsIcon icon={ChartDecreaseIcon} size={11} className="shrink-0" />
      }
      <span>{label}</span>
    </span>
  )
}
