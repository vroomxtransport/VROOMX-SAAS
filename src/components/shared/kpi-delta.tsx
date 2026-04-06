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
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground/60 bg-muted/40', className)}>
        <HugeiconsIcon icon={MinusSignIcon} size={12} />
        <span></span>
      </span>
    )
  }

  const pct = ((current - previous) / Math.abs(previous)) * 100
  const isZero = Math.abs(pct) < 0.05

  if (isZero) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground/60 bg-muted/40', className)}>
        <HugeiconsIcon icon={MinusSignIcon} size={12} />
        <span>0%</span>
      </span>
    )
  }

  const isPositiveChange = pct > 0
  // For inverted metrics (costs), positive change is bad
  const isGood = invertColor ? !isPositiveChange : isPositiveChange
  const sign = isPositiveChange ? '+' : ''
  const label = `${sign}${Math.abs(pct) >= 10 ? pct.toFixed(1) : pct.toFixed(1)}%`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        isGood
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
        className,
      )}
    >
      {isPositiveChange
        ? <HugeiconsIcon icon={ChartIncreaseIcon} size={12} className="shrink-0" />
        : <HugeiconsIcon icon={ChartDecreaseIcon} size={12} className="shrink-0" />
      }
      <span>{label}</span>
    </span>
  )
}
