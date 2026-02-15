import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

type AccentColor = 'blue' | 'amber' | 'violet' | 'emerald'

const ACCENT_STYLES: Record<AccentColor, { border: string; iconBg: string; iconText: string }> = {
  blue: {
    border: 'border-l-[var(--accent-blue)]',
    iconBg: 'bg-[var(--accent-blue-bg)]',
    iconText: 'text-[var(--accent-blue)]',
  },
  amber: {
    border: 'border-l-[var(--accent-amber)]',
    iconBg: 'bg-[var(--accent-amber-bg)]',
    iconText: 'text-[var(--accent-amber)]',
  },
  violet: {
    border: 'border-l-[var(--accent-violet)]',
    iconBg: 'bg-[var(--accent-violet-bg)]',
    iconText: 'text-[var(--accent-violet)]',
  },
  emerald: {
    border: 'border-l-[var(--accent-emerald)]',
    iconBg: 'bg-[var(--accent-emerald-bg)]',
    iconText: 'text-[var(--accent-emerald)]',
  },
}

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  accent: AccentColor
  trend?: {
    value: number
    label?: string
  }
}

export function StatCard({ label, value, sublabel, icon: Icon, accent, trend }: StatCardProps) {
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={cn(
        'rounded-xl border border-border-subtle bg-surface p-3 border-l-[3px] card-hover',
        styles.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value >= 0 ? '+' : ''}{trend.value}%
                {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
              </span>
            )}
            {sublabel && !trend && (
              <p className="text-xs text-muted-foreground">{sublabel}</p>
            )}
          </div>
        </div>
        <div className={cn('rounded-lg p-1.5', styles.iconBg)}>
          <Icon className={cn('h-5 w-5', styles.iconText)} />
        </div>
      </div>
    </div>
  )
}
