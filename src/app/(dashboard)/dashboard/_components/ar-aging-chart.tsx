'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchAgingAnalysis } from '@/lib/queries/receivables'
import type { AgingRow } from '@/lib/queries/receivables'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart3, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface AgingBucketData {
  name: string
  value: number
  color: string
}

const BUCKET_CONFIG: { key: keyof Pick<AgingRow, 'current' | '1_30' | '31_60' | '61_90' | '90_plus'>; label: string; color: string }[] = [
  { key: 'current', label: 'Current',  color: '#64748b' },
  { key: '1_30',    label: '1-30',     color: '#3b82f6' },
  { key: '31_60',   label: '31-60',    color: '#f59e0b' },
  { key: '61_90',   label: '61-90',    color: '#f97316' },
  { key: '90_plus', label: '90+',      color: '#ef4444' },
]

function aggregateBuckets(rows: AgingRow[]): AgingBucketData[] {
  const totals: Record<string, number> = {
    current: 0,
    '1_30': 0,
    '31_60': 0,
    '61_90': 0,
    '90_plus': 0,
  }

  for (const row of rows) {
    totals['current'] += row.current
    totals['1_30'] += row['1_30']
    totals['31_60'] += row['31_60']
    totals['61_90'] += row['61_90']
    totals['90_plus'] += row['90_plus']
  }

  return BUCKET_CONFIG.map(({ key, label, color }) => ({
    name: label,
    value: Math.round(totals[key] * 100) / 100,
    color,
  }))
}

function AgingTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="glass-panel rounded-xl px-4 py-3 shadow-lg border border-border-subtle min-w-[140px]">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label} days</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">
        {fmt(payload[0].value)}
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-red-500" />
          AR Aging
        </span>
        <div className="rounded-lg p-1.5 bg-red-50">
          <Clock className="h-4 w-4 text-red-500" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    </div>
  )
}

export function ArAgingChart() {
  const supabase = createClient()

  const { data: agingRows = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'ar-aging'],
    queryFn: () => fetchAgingAnalysis(supabase),
    staleTime: 30_000,
  })

  const bucketData = aggregateBuckets(agingRows)
  const totalOutstanding = agingRows.reduce((sum, r) => sum + r.total, 0)
  const hasData = bucketData.some((b) => b.value > 0)

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <div>
          <span className="widget-title">
            <span className="widget-accent-dot bg-red-500" />
            AR Aging
          </span>
          {totalOutstanding > 0 && (
            <p className="text-lg font-bold tabular-nums text-foreground mt-0.5">
              {fmt(totalOutstanding)}
            </p>
          )}
        </div>
        <div className="rounded-lg p-1.5 bg-red-50">
          <Clock className="h-4 w-4 text-red-500" />
        </div>
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No outstanding receivables</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="flex-1 min-h-0 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  dy={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v}`
                  }
                  width={48}
                />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <AgingTooltip
                      active={active}
                      payload={payload as Array<{ value: number }> | undefined}
                      label={label as string | undefined}
                    />
                  )}
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {bucketData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-border-subtle">
            {bucketData.map((bucket) => (
              <div key={bucket.name} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {bucket.name}
                  </span>
                </div>
                <p className={cn(
                  'text-xs font-semibold tabular-nums',
                  bucket.value > 0 ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {fmt(bucket.value)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
