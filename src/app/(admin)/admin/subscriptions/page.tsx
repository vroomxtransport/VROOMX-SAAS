import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard } from '@/components/shared/stat-card'
import { Badge } from '@/components/ui/badge'
import { fetchSubscriptionMetrics } from '@/app/actions/admin'
import { SubscriptionCharts } from '../../_components/subscription-charts'
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  trialing: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  past_due: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  canceled: 'bg-red-500/10 text-red-700 border-red-500/20',
  unpaid: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  suspended: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
}

const REASON_LABELS: Record<string, string> = {
  past_due: 'Past Due',
  suspended: 'Suspended',
}

function formatGracePeriod(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Expired'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `${diffDays}d remaining`
}

function isGraceUrgent(iso: string | null): boolean {
  if (!iso) return false
  const diffMs = new Date(iso).getTime() - Date.now()
  return diffMs <= 7 * 24 * 60 * 60 * 1000 && diffMs > 0
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminSubscriptionsPage() {
  const result = await fetchSubscriptionMetrics()

  if ('error' in result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscriptions"
          subtitle="Monitor Stripe subscriptions, billing status, and revenue across all tenants."
        />
        <div className="rounded-xl border border-border-subtle bg-surface p-8 text-center">
          <p className="text-sm text-red-500">Failed to load subscription metrics.</p>
        </div>
      </div>
    )
  }

  const { mrr, planDistribution, statusBreakdown, atRisk, totalTenants } = result.data

  // Derived KPIs
  const activeCount = statusBreakdown['active'] ?? 0
  const trialingCount = statusBreakdown['trialing'] ?? 0
  const activePaidSubscribers = activeCount + trialingCount

  // Trial → Paid rate: active / (active + trialing) * 100
  const trialToPaidRate =
    activePaidSubscribers > 0
      ? Math.round((activeCount / activePaidSubscribers) * 100)
      : 0

  // At-risk = past_due + suspended
  const atRiskCount = atRisk.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Monitor Stripe subscriptions, billing status, and revenue across all tenants."
      />

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={`$${mrr.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
          sublabel="Monthly recurring revenue"
          icon={DollarSign}
          accent="violet"
        />
        <StatCard
          label="Active Subscribers"
          value={activePaidSubscribers.toLocaleString()}
          sublabel={`${totalTenants > 0 ? Math.round((activePaidSubscribers / totalTenants) * 100) : 0}% of all tenants`}
          icon={Users}
          accent="emerald"
        />
        <StatCard
          label="Trial → Paid Rate"
          value={`${trialToPaidRate}%`}
          sublabel={`${activeCount} paid of ${activePaidSubscribers} active+trial`}
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          label="At-Risk Tenants"
          value={atRiskCount}
          sublabel={atRiskCount === 0 ? 'All clear' : 'Needs attention'}
          icon={AlertTriangle}
          accent="amber"
        />
      </div>

      {/* Charts: Plan Distribution + Status Breakdown */}
      <SubscriptionCharts
        planDistribution={planDistribution}
        statusBreakdown={statusBreakdown}
      />

      {/* At-Risk Tenants Table */}
      {atRiskCount > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">At-Risk Tenants</h2>
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {atRiskCount}
            </span>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tenant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      Grace Period Ends
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {atRisk.map((tenant) => {
                    const urgent = isGraceUrgent(tenant.gracePeriodEndsAt)
                    return (
                      <tr key={tenant.id} className="hover:bg-muted/20 transition-colors">
                        {/* Name */}
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="text-sm font-medium text-foreground hover:text-[var(--accent-blue)] transition-colors"
                          >
                            {tenant.name}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{tenant.slug}</p>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[10px] font-medium capitalize">
                            {tenant.plan}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                              STATUS_BADGE_STYLES[tenant.reason] ??
                                'bg-muted text-muted-foreground border-border-subtle'
                            )}
                          >
                            {REASON_LABELS[tenant.reason] ?? tenant.reason}
                          </span>
                        </td>

                        {/* Grace Period */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {tenant.gracePeriodEndsAt ? (
                            <div>
                              <span
                                className={cn(
                                  'text-xs font-medium',
                                  urgent
                                    ? 'text-red-600'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {formatGracePeriod(tenant.gracePeriodEndsAt)}
                              </span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(tenant.gracePeriodEndsAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* All-clear state for at-risk section */}
      {atRiskCount === 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">At-Risk Tenants</h2>
          <div className="flex items-center justify-center rounded-xl border border-border-subtle bg-surface py-10">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-foreground">No at-risk tenants</p>
              <p className="mt-0.5 text-xs text-muted-foreground">All subscriptions are in good standing</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
