'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanDistributionEntry {
  total: number
  active: number
  trialing: number
  pastDue: number
  canceled: number
}

interface SubscriptionChartsProps {
  planDistribution: Record<string, PlanDistributionEntry>
  statusBreakdown: Record<string, number>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, string> = {
  starter: '#3b82f6',   // blue
  pro: '#8b5cf6',       // violet
  enterprise: '#10b981', // emerald
}

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  active: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700',
    bar: '#10b981',
  },
  trialing: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700',
    bar: '#3b82f6',
  },
  past_due: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700',
    bar: '#f59e0b',
  },
  canceled: {
    bg: 'bg-red-500/10',
    text: 'text-red-700',
    bar: '#ef4444',
  },
  unpaid: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-700',
    bar: '#f43f5e',
  },
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
}

// ---------------------------------------------------------------------------
// Plan Distribution Pie Chart
// ---------------------------------------------------------------------------

interface PlanPieTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { plan: string; total: number } }>
}

function PlanPieTooltip({ active, payload }: PlanPieTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 shadow-md text-sm">
      <p className="font-semibold capitalize text-foreground">{item.name}</p>
      <p className="text-xs text-muted-foreground">{item.value} tenant{item.value !== 1 ? 's' : ''}</p>
    </div>
  )
}

function PlanDistributionChart({ planDistribution }: { planDistribution: Record<string, PlanDistributionEntry> }) {
  const data = Object.entries(planDistribution).map(([plan, dist]) => ({
    plan,
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    total: dist.total,
  }))

  const total = data.reduce((sum, d) => sum + d.total, 0)
  const hasData = total > 0

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5 h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">Plan Distribution</h3>

      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No tenant data</p>
        </div>
      ) : (
        <>
          <div className="h-[180px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="total"
                  nameKey="name"
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.plan}
                      fill={PLAN_COLORS[entry.plan] ?? '#94a3b8'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PlanPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{total}</p>
            </div>
          </div>

          {/* Legend rows with inline progress bars */}
          <div className="mt-4 space-y-2.5">
            {data.map((entry) => {
              const pct = total > 0 ? Math.round((entry.total / total) * 100) : 0
              const color = PLAN_COLORS[entry.plan] ?? '#94a3b8'
              const planDist = planDistribution[entry.plan]
              return (
                <div key={entry.plan} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-foreground capitalize">{entry.plan}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="text-muted-foreground">{entry.total} total</span>
                      <span className="text-foreground font-semibold">{pct}%</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  {/* Sub-counts */}
                  <div className="flex gap-3 text-[10px] text-muted-foreground pl-4">
                    <span>{planDist.active} active</span>
                    <span>{planDist.trialing} trialing</span>
                    {planDist.pastDue > 0 && (
                      <span className="text-amber-600">{planDist.pastDue} past due</span>
                    )}
                    {planDist.canceled > 0 && (
                      <span className="text-red-500">{planDist.canceled} canceled</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status Breakdown Bar Chart
// ---------------------------------------------------------------------------

function StatusBreakdownChart({ statusBreakdown }: { statusBreakdown: Record<string, number> }) {
  const data = Object.entries(statusBreakdown)
    .map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      color: STATUS_COLORS[status]?.bar ?? '#94a3b8',
    }))
    .sort((a, b) => b.count - a.count)

  const total = data.reduce((sum, d) => sum + d.count, 0)
  const hasData = total > 0

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-5 h-full">
      <h3 className="text-sm font-semibold text-foreground mb-4">Status Breakdown</h3>

      {!hasData ? (
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No subscription data</p>
        </div>
      ) : (
        <>
          {/* Badge row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {data.map((d) => {
              const styles = STATUS_COLORS[d.status] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
              return (
                <span
                  key={d.status}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    styles.bg,
                    styles.text
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  {d.label}
                  <span className="tabular-nums font-bold">{d.count}</span>
                </span>
              )
            })}
          </div>

          {/* Bar chart */}
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} opacity={0.5} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number | undefined) => [value ?? 0, 'Tenants']}
                  cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Percentage breakdown */}
          <div className="mt-3 space-y-1.5">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
              return (
                <div key={d.status} className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: d.color }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground w-20 text-right shrink-0">
                    {d.label}: <span className="font-medium text-foreground">{pct}%</span>
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported wrapper
// ---------------------------------------------------------------------------

export function SubscriptionCharts({ planDistribution, statusBreakdown }: SubscriptionChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PlanDistributionChart planDistribution={planDistribution} />
      <StatusBreakdownChart statusBreakdown={statusBreakdown} />
    </div>
  )
}
