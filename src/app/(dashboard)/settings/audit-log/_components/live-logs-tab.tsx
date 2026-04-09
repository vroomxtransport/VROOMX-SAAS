'use client'

import { useState, useCallback, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EnhancedFilterBar } from '@/components/shared/enhanced-filter-bar'
import { Pagination } from '@/components/shared/pagination'
import { ChangeDiffViewer } from './change-diff-viewer'
import { useAuditLogs } from '@/hooks/use-audit-logs'
import { exportAuditLogs } from '@/app/actions/audit'
import { cn } from '@/lib/utils'
import { Download, ChevronDown, ChevronRight, Loader2, Wifi } from 'lucide-react'
import type { EnhancedFilterConfig, DateRange } from '@/types/filters'
import type { AuditLog } from '@/types/database'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  { value: 'order', label: 'Order' },
  { value: 'trip', label: 'Trip' },
  { value: 'driver', label: 'Driver' },
  { value: 'truck', label: 'Truck' },
  { value: 'trailer', label: 'Trailer' },
  { value: 'compliance_doc', label: 'Compliance Doc' },
  { value: 'custom_role', label: 'Custom Role' },
  { value: 'membership', label: 'Membership' },
  { value: 'tenant', label: 'Tenant Settings' },
  { value: 'billing', label: 'Billing' },
  { value: 'expense', label: 'Expense' },
]

const ACTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'role_changed', label: 'Role Changed' },
  { value: 'plan_changed', label: 'Plan Changed' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'password_changed', label: 'Password Changed' },
  { value: 'mfa_disabled', label: 'MFA Disabled' },
]

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  updated: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  deleted: 'bg-red-500/10 text-red-700 border-red-500/20',
  status_changed: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  assigned: 'bg-violet-500/10 text-violet-700 border-violet-500/20',
  unassigned: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  role_changed: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  plan_changed: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  suspended: 'bg-red-500/10 text-red-700 border-red-500/20',
  password_changed: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  mfa_disabled: 'bg-red-500/10 text-red-700 border-red-500/20',
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-700 border-red-500/20',
}

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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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

function exportToCsv(logs: AuditLog[]) {
  const headers = [
    'Timestamp',
    'Severity',
    'Entity Type',
    'Entity ID',
    'Action',
    'Description',
    'Actor Email',
    'IP Address',
  ]
  const rows = logs.map((l) => [
    new Date(l.created_at).toISOString(),
    l.severity,
    l.entity_type,
    l.entity_id,
    l.action,
    (l.description ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
    l.actor_email ?? '',
    l.ip_address ?? '',
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

function exportToJson(logs: AuditLog[]) {
  const siem = logs.map((l) => ({
    timestamp: new Date(l.created_at).toISOString(),
    severity: l.severity,
    actor: { id: l.actor_id, email: l.actor_email },
    entity: { type: l.entity_type, id: l.entity_id },
    action: l.action,
    description: l.description,
    ip_address: l.ip_address,
    user_agent: l.user_agent,
    change_diff: l.change_diff,
    metadata: l.metadata,
  }))
  const blob = new Blob([JSON.stringify(siem, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`
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
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {Object.keys(metadata).length} field{Object.keys(metadata).length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <pre className="mt-1.5 rounded-md bg-muted/60 p-2 text-[11px] text-foreground/80 leading-relaxed overflow-x-auto max-w-[320px]">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LiveLogsTab() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [isExporting, startExportTransition] = useTransition()

  const [activeFilters, setActiveFilters] = useState<{
    search?: string
    entityType?: string
    action?: string
    severity?: 'info' | 'warning' | 'critical'
    dateRange?: DateRange
  }>({})

  const filters = {
    search: activeFilters.search,
    entityType: activeFilters.entityType,
    action: activeFilters.action,
    severity: activeFilters.severity,
    startDate: activeFilters.dateRange?.from,
    endDate: activeFilters.dateRange?.to,
    page,
    pageSize,
  }

  const { data, isLoading, isError } = useAuditLogs(filters)

  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  // ---------------------------------------------------------------------------
  // Filter handling
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback(
    (key: string, value: string | string[] | DateRange | undefined) => {
      setPage(0)
      setActiveFilters((prev) => {
        if (key === 'dateRange') {
          return { ...prev, dateRange: value as DateRange | undefined }
        }
        if (key === 'severity') {
          const v = value as string | undefined
          return {
            ...prev,
            severity: (v === 'info' || v === 'warning' || v === 'critical') ? v : undefined,
          }
        }
        return { ...prev, [key]: typeof value === 'string' ? value || undefined : undefined }
      })
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Export handlers
  // ---------------------------------------------------------------------------

  function handleExportCsv() {
    exportToCsv(logs)
  }

  function handleExportJson() {
    exportToJson(logs)
  }

  function handleServerExport(format: 'csv' | 'json') {
    startExportTransition(async () => {
      const result = await exportAuditLogs({
        search: activeFilters.search,
        entityType: activeFilters.entityType,
        action: activeFilters.action,
        severity: activeFilters.severity,
        startDate: activeFilters.dateRange?.from,
        endDate: activeFilters.dateRange?.to,
        format,
      })

      if ('error' in result) return

      if (result.success && result.data) {
        const { data: fileData, format: fmt } = result.data
        const mime = fmt === 'json' ? 'application/json' : 'text/csv'
        const ext = fmt
        const blob = new Blob([fileData], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-log-full-${new Date().toISOString().slice(0, 10)}.${ext}`
        a.click()
        URL.revokeObjectURL(url)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Filter configs
  // ---------------------------------------------------------------------------

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
      key: 'severity',
      label: 'Severity',
      type: 'select',
      options: SEVERITIES,
    },
    {
      key: 'dateRange',
      label: 'Date Range',
      type: 'date-range',
    },
  ]

  const filtersForBar: Record<string, string | string[] | DateRange | undefined> = {
    search: activeFilters.search,
    entityType: activeFilters.entityType,
    action: activeFilters.action,
    severity: activeFilters.severity,
    dateRange: activeFilters.dateRange,
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Filter bar + export buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <EnhancedFilterBar
            filters={filterConfigs}
            activeFilters={filtersForBar}
            onFilterChange={handleFilterChange}
            resultCount={total}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" />
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Live</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="h-9 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJson}
            disabled={logs.length === 0}
            className="h-9 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleServerExport('csv')}
            disabled={isExporting}
            title="Export all matching records (up to 10,000)"
            className="h-9 gap-1.5 text-xs"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Full Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="relative rounded-xl border border-border-subtle bg-surface overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="p-6 text-center text-sm text-red-500">
            Failed to load audit logs. Please try again.
          </div>
        )}

        {!isError && !isLoading && logs.length === 0 ? (
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
                    Severity
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
                    Changes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Metadata
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="text-xs text-foreground tabular-nums cursor-default"
                        title={formatAbsolute(log.created_at)}
                      >
                        {formatRelative(log.created_at)}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                          SEVERITY_STYLES[log.severity] ??
                            'bg-muted text-muted-foreground border-border-subtle'
                        )}
                      >
                        {log.severity}
                      </span>
                    </td>

                    {/* Entity Type */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-medium capitalize">
                        {log.entity_type.replace(/_/g, ' ')}
                      </Badge>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                          ACTION_STYLES[log.action] ??
                            'bg-muted text-muted-foreground border-border-subtle'
                        )}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 max-w-[260px]">
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

                    {/* Changes diff */}
                    <td className="px-4 py-3">
                      <ChangeDiffViewer changeDiff={log.change_diff} />
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
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(0)
        }}
      />
    </div>
  )
}
