import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatCard } from '@/components/shared/stat-card'
import {
  Package,
  Route,
  Users,
  Truck,
  CreditCard,
  ExternalLink,
  Clock,
  User,
  Activity,
} from 'lucide-react'

// ── Plan / status display helpers ──────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  owner_operator: 'text-emerald-700',
  starter_x:      'bg-brand/10 text-brand border-brand/20',
  pro_x:          'text-blue-700',
}
const PLAN_LABELS: Record<string, string> = {
  owner_operator: 'Owner-Operator',
  starter_x:      'Starter X',
  pro_x:          'Pro X',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-700',
  trialing: 'text-blue-700',
  past_due: 'text-amber-700',
  canceled: 'text-gray-500',
  suspended: 'text-red-700',
  unpaid: 'text-orange-700',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
  suspended: 'Suspended',
  unpaid: 'Unpaid',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  owner: 'Owner',
  dispatcher: 'Dispatcher',
  billing: 'Billing',
  safety: 'Safety',
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

// ── Data types (matching what fetchTenantDetail returns) ───────────────────────
interface TenantRecord {
  id: string
  name: string
  slug: string
  plan: string
  subscription_status: string
  is_suspended: boolean
  trial_ends_at: string | null
  grace_period_ends_at: string | null
  stripe_customer_id: string | null
  dot_number: string | null
  mc_number: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  created_at: string
  updated_at: string | null
}

interface MemberRecord {
  id: string
  user_id: string
  role: string
  name: string | null
  email: string | null
  created_at: string
}

interface AuditLogRecord {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  description: string | null
  actor_email: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

interface EntityCounts {
  orders: number
  trips: number
  drivers: number
  trucks: number
}

export interface TenantDetailData {
  tenant: TenantRecord
  members: MemberRecord[]
  entityCounts: EntityCounts
  auditLogs: AuditLogRecord[]
  revenueMtd: number
}

// ── Overview stat cards ────────────────────────────────────────────────────────
function OverviewStats({ counts }: { counts: EntityCounts }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Orders"
        value={counts.orders.toLocaleString()}
        icon={Package}
        accent="blue"
      />
      <StatCard
        label="Trips"
        value={counts.trips.toLocaleString()}
        icon={Route}
        accent="violet"
      />
      <StatCard
        label="Drivers"
        value={counts.drivers.toLocaleString()}
        icon={Users}
        accent="emerald"
      />
      <StatCard
        label="Trucks"
        value={counts.trucks.toLocaleString()}
        icon={Truck}
        accent="amber"
      />
    </div>
  )
}

// ── Subscription card ──────────────────────────────────────────────────────────
function SubscriptionCard({ tenant }: { tenant: TenantRecord }) {
  const effStatus = tenant.is_suspended ? 'suspended' : tenant.subscription_status

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Subscription & Company Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Subscription details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Subscription
            </h3>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Plan</dt>
                <dd>
                  <Badge variant="outline" className={`text-xs ${PLAN_COLORS[tenant.plan] ?? ''}`}>
                    {PLAN_LABELS[tenant.plan] ?? tenant.plan}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[effStatus] ?? ''}`}>
                    {STATUS_LABELS[effStatus] ?? effStatus}
                  </Badge>
                </dd>
              </div>
              {tenant.trial_ends_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">Trial ends</dt>
                  <dd className="text-sm font-medium">{formatDate(tenant.trial_ends_at)}</dd>
                </div>
              )}
              {tenant.grace_period_ends_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">Grace period ends</dt>
                  <dd className="text-sm font-medium text-amber-600">
                    {formatDate(tenant.grace_period_ends_at)}
                  </dd>
                </div>
              )}
              {tenant.stripe_customer_id && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">Stripe customer</dt>
                  <dd>
                    <a
                      href={`https://dashboard.stripe.com/customers/${tenant.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      {tenant.stripe_customer_id.slice(0, 16)}…
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Member since</dt>
                <dd className="text-sm">{formatDate(tenant.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Company details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </h3>
            <dl className="space-y-2">
              {tenant.dot_number && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">DOT #</dt>
                  <dd className="text-sm font-mono">{tenant.dot_number}</dd>
                </div>
              )}
              {tenant.mc_number && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-muted-foreground">MC #</dt>
                  <dd className="text-sm font-mono">{tenant.mc_number}</dd>
                </div>
              )}
              {(tenant.address || tenant.city) && (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-sm text-muted-foreground shrink-0">Address</dt>
                  <dd className="text-sm text-right">
                    {[tenant.address, tenant.city, tenant.state, tenant.zip]
                      .filter(Boolean)
                      .join(', ')}
                  </dd>
                </div>
              )}
              {!tenant.dot_number && !tenant.mc_number && !tenant.address && (
                <p className="text-sm text-muted-foreground/60 italic">No company details on file</p>
              )}
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Team members card ──────────────────────────────────────────────────────────
function TeamMembersCard({ members }: { members: MemberRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" />
              Team Members
            </CardTitle>
            <CardDescription>All users with access to this tenant</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {members.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {members.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No team members found
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_1fr_100px_120px] gap-2 border-b border-border bg-muted/50 px-6 py-2">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <span className="text-xs font-medium text-muted-foreground">Joined</span>
            </div>
            {members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[1fr_1fr_100px_120px] gap-2 items-center border-b border-border px-6 py-3 last:border-b-0 hover:bg-muted/20 transition-colors"
              >
                <div className="truncate text-sm font-medium">
                  {member.name ?? <span className="text-muted-foreground italic">—</span>}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {member.email ?? <span className="text-muted-foreground">—</span>}
                </div>
                <div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(member.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Recent activity card ───────────────────────────────────────────────────────
function RecentActivityCard({ logs }: { logs: AuditLogRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription>Last 50 audit log entries for this tenant</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {logs.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet
          </div>
        ) : (
          <div className="overflow-auto">
            {/* Header row */}
            <div className="grid grid-cols-[80px_120px_100px_1fr_140px] gap-2 border-b border-border bg-muted/50 px-6 py-2 min-w-[640px]">
              <span className="text-xs font-medium text-muted-foreground">Time</span>
              <span className="text-xs font-medium text-muted-foreground">Entity</span>
              <span className="text-xs font-medium text-muted-foreground">Action</span>
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              <span className="text-xs font-medium text-muted-foreground">Actor</span>
            </div>
            <div className="min-w-[640px]">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-[80px_120px_100px_1fr_140px] gap-2 items-start border-b border-border px-6 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {relativeTime(log.created_at)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground capitalize">
                    {log.entity_type.replace(/_/g, ' ')}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {log.action}
                    </Badge>
                  </div>
                  <div className="truncate text-sm">
                    {log.description ?? <span className="text-muted-foreground italic">—</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {log.actor_email ?? <span className="text-muted-foreground">system</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main TenantDetail export (server-renderable — no client state) ─────────────
export function TenantDetail({ data }: { data: TenantDetailData }) {
  const { tenant, members, entityCounts, auditLogs } = data

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to Tenants
      </Link>

      {/* Stat overview */}
      <OverviewStats counts={entityCounts} />

      {/* Subscription + company info */}
      <SubscriptionCard tenant={tenant} />

      {/* Team members */}
      <TeamMembersCard members={members} />

      {/* Audit log */}
      <RecentActivityCard logs={auditLogs} />
    </div>
  )
}
