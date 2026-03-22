import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ActivityLogEntry {
  id: string
  actor_email: string
  action: string
  target_tenant_id: string | null
  description: string
  created_at: string
}

interface TenantMap {
  [tenantId: string]: string
}

interface AdminActivityLogProps {
  entries: ActivityLogEntry[]
  tenantNames: TenantMap
}

/** Map raw action strings to human-readable labels */
function formatAction(action: string): string {
  const labels: Record<string, string> = {
    'tenant.suspended': 'Tenant Suspended',
    'tenant.unsuspended': 'Tenant Unsuspended',
    'tenant.trial_extended': 'Trial Extended',
    'tenant.plan_changed': 'Plan Changed',
    'tenant.created': 'Tenant Created',
    'tenant.deleted': 'Tenant Deleted',
    'admin.login': 'Admin Login',
  }
  return labels[action] ?? action
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
}

/** Color-code actions for quick scanning */
function actionBadgeClass(action: string): string {
  if (action.includes('suspend')) return 'text-red-400 bg-red-500/10 border-red-500/20'
  if (action.includes('trial')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  if (action.includes('created')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (action.includes('deleted')) return 'text-red-400 bg-red-500/10 border-red-500/20'
  return 'text-[var(--sidebar-text)] bg-[var(--sidebar-bg-subtle)] border-[var(--sidebar-border-color)]'
}

export function AdminActivityLog({ entries, tenantNames }: AdminActivityLogProps) {
  if (entries.length === 0) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-[var(--sidebar-border-color)] bg-[var(--sidebar-bg-subtle)]">
        <p className="text-sm text-[var(--sidebar-category)]">No platform activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--sidebar-border-color)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-[var(--sidebar-border-color)] hover:bg-transparent">
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] w-28">
              Time
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] w-44">
              Tenant
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] w-48">
              Action
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
              Description
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-category)] w-48">
              Actor
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const tenantName = entry.target_tenant_id
              ? (tenantNames[entry.target_tenant_id] ?? entry.target_tenant_id.slice(0, 8) + '…')
              : null

            let relativeTime: string
            try {
              relativeTime = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
            } catch {
              relativeTime = entry.created_at
            }

            return (
              <TableRow
                key={entry.id}
                className="border-b border-[var(--sidebar-border-color)] last:border-0 hover:bg-[var(--sidebar-hover)]"
              >
                {/* Time */}
                <TableCell className="text-xs text-[var(--sidebar-category)] tabular-nums whitespace-nowrap py-2.5">
                  {relativeTime}
                </TableCell>

                {/* Tenant */}
                <TableCell className="text-xs py-2.5">
                  {entry.target_tenant_id && tenantName ? (
                    <Link
                      href={`/admin/tenants/${entry.target_tenant_id}`}
                      className="font-medium text-[var(--sidebar-text-active)] hover:text-amber-400 transition-colors underline-offset-2 hover:underline"
                    >
                      {tenantName}
                    </Link>
                  ) : (
                    <span className="text-[var(--sidebar-category)]">—</span>
                  )}
                </TableCell>

                {/* Action badge */}
                <TableCell className="py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${actionBadgeClass(entry.action)}`}
                  >
                    {formatAction(entry.action)}
                  </span>
                </TableCell>

                {/* Description */}
                <TableCell className="text-xs text-[var(--sidebar-text)] py-2.5 max-w-sm truncate">
                  {entry.description || '—'}
                </TableCell>

                {/* Actor */}
                <TableCell className="text-xs text-[var(--sidebar-category)] py-2.5 truncate max-w-[12rem]">
                  {entry.actor_email}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
