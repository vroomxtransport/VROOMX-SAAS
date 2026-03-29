'use client'

import { cn } from '@/lib/utils'

interface ComplianceScoreCardProps {
  entityName: string
  score: number // 0–100
  docCount: number
  requiredCount: number
}

function getScoreColor(score: number): { stroke: string; text: string; bg: string } {
  if (score >= 80) {
    return {
      stroke: 'var(--accent-emerald)',
      text: 'text-emerald-600',
      bg: 'bg-emerald-50',
    }
  }
  if (score >= 50) {
    return {
      stroke: 'var(--accent-amber)',
      text: 'text-amber-600',
      bg: 'bg-amber-50',
    }
  }
  return {
    stroke: '#ef4444',
    text: 'text-red-600',
    bg: 'bg-red-50',
  }
}

export function ComplianceScoreCard({
  entityName,
  score,
  docCount,
  requiredCount,
}: ComplianceScoreCardProps) {
  const colors = getScoreColor(score)

  // SVG ring params
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Circular progress ring */}
      <div className="relative shrink-0">
        <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
          {/* Track */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-muted/30"
          />
          {/* Progress */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Percentage label */}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center text-[10px] font-bold',
            colors.text
          )}
        >
          {score}%
        </span>
      </div>

      {/* Entity info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entityName}</p>
        <p className="text-xs text-muted-foreground">
          {docCount}/{requiredCount} docs
        </p>
      </div>

      {/* Score pill */}
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
          colors.text,
          colors.bg
        )}
      >
        {score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Action needed'}
      </span>
    </div>
  )
}
