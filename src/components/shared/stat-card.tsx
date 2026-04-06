import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  accent?: 'blue' | 'amber' | 'emerald' | 'violet'
  trend?: {
    value: number
    label?: string
  }
}

const ACCENT_STYLES = {
  blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  amber: { border: 'border-l-amber-500', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
  emerald: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
  violet: { border: 'border-l-violet-500', iconBg: 'bg-violet-50', iconText: 'text-violet-600' },
}

const SPARKLINE_PATHS: Record<string, string> = {
  blue: 'M0,24 C8,22 16,18 24,20 C32,22 40,12 48,8 C56,4 60,6 64,4',
  amber: 'M0,20 C8,18 16,22 24,16 C32,10 40,14 48,8 C56,6 60,10 64,6',
  emerald: 'M0,28 C8,24 16,20 24,16 C32,12 40,14 48,8 C56,4 60,6 64,2',
  violet: 'M0,16 C8,20 16,18 24,22 C32,20 40,16 48,18 C56,14 60,16 64,12',
}

const SPARKLINE_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  emerald: '#10b981',
  violet: '#8b5cf6',
}

export function StatCard({ label, value, sublabel, icon: Icon, accent = 'blue', trend }: StatCardProps) {
  const a = ACCENT_STYLES[accent]

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${a.iconBg}`}>
          <Icon className={`h-5 w-5 ${a.iconText}`} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
          {trend && (
            <>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                trend.value >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}>
                {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
            </>
          )}
          {sublabel && !trend && <p className="text-xs text-muted-foreground">{sublabel}</p>}
          {/* Mini sparkline */}
          <svg className="h-8 w-16 ml-auto" viewBox="0 0 64 32" fill="none">
            <path
              d={SPARKLINE_PATHS[accent] || SPARKLINE_PATHS.blue}
              stroke={SPARKLINE_COLORS[accent] || SPARKLINE_COLORS.blue}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
    </div>
  )
}
