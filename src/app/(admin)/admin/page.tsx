import { fetchPlatformStats } from '@/app/actions/admin'
import { PageHeader } from '@/components/shared/page-header'
import { PlatformStats } from '../_components/platform-stats'
import { AdminActivityLog } from '../_components/admin-activity-log'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Plan display config
// ---------------------------------------------------------------------------

const PLAN_CONFIG: Record<
  string,
  { label: string; barColor: string; badgeClass: string }
> = {
  owner_operator: {
    label: 'Owner-Operator',
    barColor: 'bg-[var(--accent-emerald)]',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  starter_x: {
    label: 'Starter X',
    barColor: 'bg-[var(--accent-orange,var(--accent-amber))]',
    badgeClass: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
  },
  pro_x: {
    label: 'Pro X',
    barColor: 'bg-[var(--accent-blue)]',
    badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
}

const PLAN_ORDER = ['owner_operator', 'starter_x', 'pro_x']

function PlanBadge({ plan }: { plan: string }) {
  const cfg = PLAN_CONFIG[plan] ?? {
    label: plan,
    badgeClass: 'border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg-subtle)] text-[var(--sidebar-category)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.badgeClass}`}
    >
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function AdminDashboardPage() {
  const result = await fetchPlatformStats()

  // If auth fails or an error occurs, show a minimal error state
  if ('error' in result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Dashboard"
          subtitle="System-wide metrics, tenant health, and operational overview."
        />
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 text-center px-6">
          <p className="text-sm font-medium text-red-400">
            Failed to load platform stats.
          </p>
          <p className="mt-1 text-xs text-[var(--sidebar-category)]">
            {typeof result.error === 'string' ? result.error : 'An unexpected error occurred.'}
          </p>
        </div>
      </div>
    )
  }

  const {
    totalTenants,
    activeSubscriptions,
    atRisk,
    mrr,
    recentActivity,
    planDistribution,
    topTenants,
    signupTrend,
  } = result.data

  // Build tenant name lookup from recent activity (populated later via
  // a join if needed — for now the platform_audit_logs table stores
  // target_tenant_id only, so we resolve names from topTenants + atRisk)
  const tenantNameMap: Record<string, string> = {}
  for (const t of atRisk) {
    tenantNameMap[t.id] = t.name
  }
  for (const t of topTenants) {
    tenantNameMap[t.id] = t.name
  }

  // Plan distribution — sorted into a stable order
  const planRows = PLAN_ORDER
    .filter((plan) => plan in planDistribution)
    .map((plan) => ({
      plan,
      ...planDistribution[plan],
    }))
  // Also include any unexpected plans not in PLAN_ORDER
  for (const plan of Object.keys(planDistribution)) {
    if (!PLAN_ORDER.includes(plan)) {
      planRows.push({ plan, ...planDistribution[plan] })
    }
  }

  const maxPlanTotal = Math.max(1, ...planRows.map((r) => r.total))

  return (
    <div className="space-y-8">
      {/* Page header */}
      <PageHeader
        title="Platform Dashboard"
        subtitle="System-wide metrics, tenant health, and operational overview."
      >
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--sidebar-category)]">
          <RefreshCw className="h-3 w-3" />
          Live data
        </span>
      </PageHeader>

      {/* ------------------------------------------------------------------ */}
      {/* KPI Cards                                                           */}
      {/* ------------------------------------------------------------------ */}
      <PlatformStats
        totalTenants={totalTenants}
        activeSubscriptions={activeSubscriptions}
        mrr={mrr}
        atRiskCount={atRisk.length}
        signupTrend={signupTrend}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Middle row: Plan Distribution + Top 5 Tenants                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Plan Distribution */}
        <section
          aria-labelledby="plan-dist-heading"
          className="rounded-xl border border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg-subtle)] p-5"
        >
          <h2
            id="plan-dist-heading"
            className="text-sm font-semibold text-[var(--sidebar-text-active)] mb-4"
          >
            Plan Distribution
          </h2>

          {planRows.length === 0 ? (
            <p className="text-xs text-[var(--sidebar-category)]">No plan data yet.</p>
          ) : (
            <div className="space-y-4">
              {planRows.map(({ plan, total, active }) => {
                const cfg = PLAN_CONFIG[plan]
                const label = cfg?.label ?? plan
                const barColor = cfg?.barColor ?? 'bg-[var(--sidebar-text)]'
                const pct = Math.round((total / maxPlanTotal) * 100)

                return (
                  <div key={plan} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--sidebar-text-active)]">
                          {label}
                        </span>
                        <span className="text-xs text-[var(--sidebar-category)]">
                          {active} active
                        </span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-[var(--sidebar-text-active)]">
                        {total}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--sidebar-bg)]">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={total}
                        aria-valuemax={maxPlanTotal}
                        aria-label={`${label} tenants`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Top 5 Tenants by Order Count */}
        <section
          aria-labelledby="top-tenants-heading"
          className="rounded-xl border border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg-subtle)] p-5"
        >
          <h2
            id="top-tenants-heading"
            className="text-sm font-semibold text-[var(--sidebar-text-active)] mb-4"
          >
            Top Tenants by Order Count
          </h2>

          {topTenants.length === 0 ? (
            <p className="text-xs text-[var(--sidebar-category)]">No order data yet.</p>
          ) : (
            <div className="rounded-lg border border-[var(--sidebar-border-color)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[var(--sidebar-border-color)] hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                      Tenant
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] text-right">
                      Orders
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] text-right">
                      Plan
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topTenants.map((tenant, idx) => (
                    <TableRow
                      key={tenant.id}
                      className="border-b border-[var(--sidebar-border-color)] last:border-0 hover:bg-[var(--sidebar-hover)]"
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sidebar-bg)] text-[10px] font-bold text-[var(--sidebar-category)] tabular-nums">
                            {idx + 1}
                          </span>
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            className="text-sm font-medium text-[var(--sidebar-text-active)] hover:text-amber-400 transition-colors hover:underline underline-offset-2"
                          >
                            {tenant.name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums text-[var(--sidebar-text-active)] text-right py-2.5">
                        {tenant.orderCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <PlanBadge plan={tenant.plan} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* At-Risk Tenants (if any)                                           */}
      {/* ------------------------------------------------------------------ */}
      {atRisk.length > 0 && (
        <section aria-labelledby="at-risk-heading">
          <h2
            id="at-risk-heading"
            className="text-sm font-semibold text-[var(--sidebar-text-active)] mb-3"
          >
            At-Risk Tenants
            <span className="ml-2 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
              {atRisk.length}
            </span>
          </h2>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-amber-500/20 hover:bg-transparent">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    Tenant
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    Plan
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    Grace Period Ends
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.map((tenant) => {
                  const isSuspended = tenant.is_suspended
                  const statusLabel = isSuspended ? 'Suspended' : 'Past Due'
                  const statusClass = isSuspended
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-400'

                  let gracePeriodDisplay = '—'
                  if (tenant.grace_period_ends_at) {
                    try {
                      gracePeriodDisplay = new Date(tenant.grace_period_ends_at).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )
                    } catch {
                      gracePeriodDisplay = tenant.grace_period_ends_at
                    }
                  }

                  return (
                    <TableRow
                      key={tenant.id}
                      className="border-b border-amber-500/10 last:border-0 hover:bg-amber-500/5"
                    >
                      <TableCell className="py-2.5">
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="text-sm font-medium text-[var(--sidebar-text-active)] hover:text-amber-400 transition-colors hover:underline underline-offset-2"
                        >
                          {tenant.name}
                        </Link>
                        <p className="text-xs text-[var(--sidebar-category)]">{tenant.slug}</p>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <PlanBadge plan={tenant.plan} />
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-[var(--sidebar-category)] py-2.5 tabular-nums">
                        {gracePeriodDisplay}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Recent Platform Activity                                           */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="activity-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="activity-heading"
            className="text-sm font-semibold text-[var(--sidebar-text-active)]"
          >
            Recent Platform Activity
          </h2>
          <Link
            href="/admin/audit-log"
            className="text-xs text-[var(--sidebar-category)] hover:text-amber-400 transition-colors"
          >
            View full audit log
          </Link>
        </div>

        <AdminActivityLog
          entries={recentActivity}
          tenantNames={tenantNameMap}
        />
      </section>
    </div>
  )
}
