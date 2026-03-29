'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { fetchAuditLogs } from '@/app/actions/admin'
import { cn } from '@/lib/utils'
import { Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import type { EnhancedFilterConfig } from '@/types/filters'
import type { DateRange } from '@/types/filters'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string
  tenant_id: string
  entity_type: string
  entity_id: string | null
  action: string
  description: string | null
  actor_id: string | null
  actor_email: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  tenantName: string | null
}

interface AuditLogTableProps {
  initialLogs: AuditLogEntry[]
  initialTotal: number
  tenants: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  { value: 'order', label: 'Order' },
  { value: 'trip', label: 'Trip' },
  { value: 'driver', label: 'Driver' },
  { value: 'truck', label: 'Truck' },
  { value: 'compliance_doc', label: 'Compliance Doc' },
  { value: 'custom_role', label: 'Custom Role' },
]

const ACTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
]

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  updated: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  deleted: 'bg-red-500/10 text-red-700 border-red-500/20',
  status_changed: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  assigned: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  unassigned: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
}

const PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function exportToCsv(logs: AuditLogEntry[]) {
  const headers = ['Timestamp', 'Tenant', 'Entity Type', 'Action', 'Description', 'Actor']
  const rows = logs.map((l) => [
    new Date(l.created_at).toISOString(),
    l.tenantName ?? l.tenant_id,
    l.entity_type,
    l.action,
    (l.description ?? '').replace(/,/g, ';'),
    l.actor_email ?? '',
  ])

  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// MetadataCell — expandable JSON viewer
// ---------------------------------------------------------------------------

function MetadataCell({ metadata }: { metadata: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {Object.keys(metadata).length} field{Object.keys(metadata).length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <pre className="mt-1.5 rounded-md bg-muted/60 p-2 text-[11px] text-foreground/80 leading-relaxed overflow-x-auto max-w-[360px]">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AuditLogTable({ initialLogs, initialTotal, tenants }: AuditLogTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Derive filter state from URL
  const getParam = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams]
  )

  const activeFilters: Record<string, string | string[] | DateRange | undefined> = {
    search: getParam('search'),
    entityType: getParam('entityType'),
    action: getParam('action'),
    tenantId: getParam('tenantId'),
    dateRange:
      getParam('startDate') && getParam('endDate')
        ? { from: getParam('startDate')!, to: getParam('endDate')! }
        : undefined,
  }

  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  // Live data — updated as filters change
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs)
  const [total, setTotal] = useState(initialTotal)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // Update URL + re-fetch
  // ---------------------------------------------------------------------------

  function buildParams(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === '') {
        params.delete(k)
      } else {
        params.set(k, v)
      }
    }
    return params
  }

  const applyFilters = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = buildParams({ ...overrides, page: '0' })
      router.push(`${pathname}?${params.toString()}`, { scroll: false })

      startTransition(async () => {
        const dateRange = params.get('startDate') && params.get('endDate')
          ? { from: params.get('startDate')!, to: params.get('endDate')! }
          : undefined

        const result = await fetchAuditLogs({
          search: params.get('search') ?? undefined,
          entityType: params.get('entityType') ?? undefined,
          action: params.get('action') ?? undefined,
          tenantId: params.get('tenantId') ?? undefined,
          startDate: dateRange?.from,
          endDate: dateRange?.to,
          page: 1,
          pageSize: PAGE_SIZE,
        })

        if ('error' in result) {
          setFetchError(result.error as string)
        } else if (result.success) {
          setLogs(result.data.logs as AuditLogEntry[])
          setTotal(result.data.total)
          setFetchError(null)
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, searchParams]
  )

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      if (key === 'dateRange') {
        const dr = value as DateRange | undefined
        applyFilters({
          startDate: dr?.from,
          endDate: dr?.to,
        })
      } else {
        applyFilters({ [key]: typeof value === 'string' ? value : undefined })
      }
    },
    [applyFilters]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const params = buildParams({ page: String(page) })
      router.push(`${pathname}?${params.toString()}`, { scroll: false })

      startTransition(async () => {
        const result = await fetchAuditLogs({
          search: params.get('search') ?? undefined,
          entityType: params.get('entityType') ?? undefined,
          action: params.get('action') ?? undefined,
          tenantId: params.get('tenantId') ?? undefined,
          startDate: params.get('startDate') ?? undefined,
          endDate: params.get('endDate') ?? undefined,
          page: page + 1,
          pageSize: PAGE_SIZE,
        })

        if ('error' in result) {
          setFetchError(result.error as string)
        } else if (result.success) {
          setLogs(result.data.logs as AuditLogEntry[])
          setTotal(result.data.total)
          setFetchError(null)
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, searchParams]
  )

  // ---------------------------------------------------------------------------
  // Filter configs
  // ---------------------------------------------------------------------------

  const tenantOptions = tenants.map((t) => ({ value: t.id, label: t.name }))

  const filterConfigs: EnhancedFilterConfig[] = [
    {
      key: 'search',
      label: 'Search',
      type: 'search',
      placeholder: 'Search description or actor email…',
    },
    {
      key: 'entityType',
      label: 'Entity Type',
      type: 'select',
      options: ENTITY_TYPES,
    },
    {
      key: 'action',
      label: 'Action',
      type: 'select',
      options: ACTIONS,
    },
    {
      key: 'tenantId',
      label: 'Tenant',
      type: 'select',
      options: tenantOptions,
    },
    {
      key: 'dateRange',
      label: 'Date Range',
      type: 'date-range',
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Filter bar + export button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={filterConfigs}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            resultCount={total}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(logs)}
          disabled={logs.length === 0}
          className="h-9 shrink-0 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-border-subtle bg-surface overflow-hidden">
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {fetchError && (
          <div className="p-4 text-sm text-red-500">{fetchError}</div>
        )}

        {!fetchError && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-medium text-foreground">No audit log entries found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="text-xs text-foreground tabular-nums cursor-default"
                        title={formatAbsolute(log.created_at)}
                      >
                        {formatRelative(log.created_at)}
                      </span>
                    </td>

                    {/* Tenant */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.tenant_id ? (
                        <Link
                          href={`/admin/tenants/${log.tenant_id}`}
                          className="text-xs font-medium text-foreground hover:text-[var(--accent-blue)] transition-colors"
                        >
                          {log.tenantName ?? log.tenant_id.slice(0, 8) + '…'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">System</span>
                      )}
                    </td>

                    {/* Entity Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium capitalize"
                      >
                        {log.entity_type.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                          ACTION_STYLES[log.action] ?? 'bg-muted text-muted-foreground border-border-subtle'
                        )}
                      >
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 max-w-[280px]">
                      <span className="text-xs text-foreground/80 line-clamp-2">
                        {log.description ?? '—'}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        {log.actor_email ?? '—'}
                      </span>
                    </td>

                    {/* Metadata */}
                    <td className="px-4 py-3">
                      <MetadataCell metadata={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        page={currentPage}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={handlePageChange}
      />
    </div>
  )
}
