'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchBrokerScorecard, type BrokerScore } from '@/lib/queries/broker-scorecard'
import { ChevronRight, Award } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const GRADE_STYLES: Record<BrokerScore['grade'], { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  B: { bg: 'bg-blue-100', text: 'text-blue-700' },
  C: { bg: 'bg-amber-100', text: 'text-amber-700' },
  D: { bg: 'bg-orange-100', text: 'text-orange-700' },
  F: { bg: 'bg-red-100', text: 'text-red-700' },
}

const GRADE_BAR_COLORS: Record<BrokerScore['grade'], string> = {
  A: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  B: 'bg-gradient-to-r from-blue-500 to-blue-400',
  C: 'bg-gradient-to-r from-amber-500 to-amber-400',
  D: 'bg-gradient-to-r from-orange-500 to-orange-400',
  F: 'bg-gradient-to-r from-red-500 to-red-400',
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-[var(--accent-blue)]" />
          Broker Scorecard
        </span>
      </div>
      <div className="flex-1 space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-muted" />
              <div className="flex-1 h-3 rounded bg-muted" />
              <div className="h-3 w-14 rounded bg-muted" />
            </div>
            <div className="h-1.5 rounded-full bg-muted ml-[2.375rem]" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function BrokerScorecardMini() {
  const supabase = createClient()

  const { data: allBrokers = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'broker-scorecard-mini'],
    queryFn: () => fetchBrokerScorecard(supabase),
    staleTime: 60_000,
  })

  const brokers = allBrokers.slice(0, 5)

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-[var(--accent-blue)]" />
          Broker Scorecard
        </span>
        <div className="rounded-lg p-1.5 bg-blue-50">
          <Award className="h-4 w-4 text-blue-600" />
        </div>
      </div>

      {brokers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No broker data this period</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden space-y-3">
          {brokers.map((broker) => {
            const gradeStyle = GRADE_STYLES[broker.grade]
            const barColor = GRADE_BAR_COLORS[broker.grade]

            return (
              <div key={broker.brokerId} className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  {/* Grade badge */}
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      gradeStyle.bg,
                      gradeStyle.text
                    )}
                  >
                    {broker.grade}
                  </span>

                  {/* Broker name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {broker.brokerName}
                    </span>
                  </div>

                  {/* Score and revenue */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {Math.round(broker.compositeScore)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {fmt(broker.totalRevenue)}
                    </span>
                  </div>
                </div>

                {/* Score progress bar */}
                <div className="h-1.5 rounded-full bg-border-subtle overflow-hidden ml-[2.375rem]">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-500',
                      barColor
                    )}
                    style={{ width: `${broker.compositeScore}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/brokers/scorecard"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-brand"
      >
        View Full Scorecard
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
