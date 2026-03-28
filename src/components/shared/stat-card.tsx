import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  accent?: string // kept for backward compat, ignored
  trend?: {
    value: number
    label?: string
  }
}

export function StatCard({ label, value, sublabel, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p
            className="text-sm font-medium uppercase tracking-wide"
            style={{ color: 'var(--foreground)', opacity: 0.55 }}
          >
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2.5">
          <Icon className="h-5 w-5" style={{ color: 'var(--foreground)', opacity: 0.5 }} />
        </div>
      </div>

      {(trend || sublabel) && (
        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <span
              className="inline-flex items-center gap-1 text-sm font-medium tabular-nums"
              style={{ color: trend.value >= 0 ? '#059669' : '#dc2626' }}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.value >= 0 ? '+' : ''}{trend.value}%
              {trend.label && (
                <span
                  className="font-normal ml-1"
                  style={{ color: 'var(--foreground)', opacity: 0.45 }}
                >
                  {trend.label}
                </span>
              )}
            </span>
          )}
          {sublabel && !trend && (
            <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.5 }}>{sublabel}</p>
          )}
        </div>
      )}
    </div>
  )
}
