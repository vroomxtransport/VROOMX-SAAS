'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type {
  TruckExpenseEntry,
  NormalizedExpenseCategory,
  QBSyncStatus,
  TruckExpenseSourceTable,
} from '@/lib/queries/truck-expense-ledger'
import { retryQbSync } from '@/app/actions/truck-expenses'
import { useCurrentUserPermissions } from '@/hooks/use-current-user-permissions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Search, X, Plus, Loader2, RefreshCw } from 'lucide-react'

interface TruckExpenseLedgerProps {
  entries: TruckExpenseEntry[]
  isLoading: boolean
  onAddExpense: () => void
}

type CategoryFilter = 'all' | NormalizedExpenseCategory

const CATEGORY_BADGE_COLORS: Record<NormalizedExpenseCategory, string> = {
  fuel: 'bg-slate-900/90 text-white',
  tolls: 'bg-sky-100 text-sky-800',
  repairs: 'bg-amber-100 text-amber-800',
  lodging: 'bg-violet-100 text-violet-800',
  maintenance: 'bg-indigo-100 text-indigo-800',
  insurance: 'bg-emerald-100 text-emerald-800',
  truck_lease: 'bg-slate-200 text-slate-800',
  registration: 'bg-teal-100 text-teal-800',
  dispatch: 'bg-slate-100 text-slate-700',
  parking: 'bg-slate-100 text-slate-700',
  rent: 'bg-slate-100 text-slate-700',
  telematics: 'bg-slate-100 text-slate-700',
  salary: 'bg-slate-100 text-slate-700',
  office_supplies: 'bg-slate-100 text-slate-700',
  software: 'bg-slate-100 text-slate-700',
  professional_services: 'bg-slate-100 text-slate-700',
  misc: 'bg-slate-100 text-slate-700',
}

const SOURCE_BADGE_STYLES: Record<string, string> = {
  manual: 'border-border bg-card text-muted-foreground',
  samsara: 'border-blue-200 bg-blue-50 text-blue-700',
  quickbooks: 'border-green-200 bg-green-50 text-green-700',
  efs: 'border-orange-200 bg-orange-50 text-orange-700',
  msfuelcard: 'border-amber-200 bg-amber-50 text-amber-700',
}

const SOURCE_BADGE_LABELS: Record<string, string> = {
  manual: 'Manual',
  samsara: 'Samsara',
  quickbooks: 'QuickBooks',
  efs: 'EFS',
  msfuelcard: 'MSFuelCard',
}

const QB_BADGE_STYLES: Record<QBSyncStatus, string> = {
  'n/a': '',
  pending: 'bg-slate-100 text-slate-700',
  synced: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
}

const QB_BADGE_LABELS: Record<QBSyncStatus, string> = {
  'n/a': '',
  pending: 'Pending',
  synced: 'Synced',
  error: 'Error',
}

/** Maps sourceTable → expenseSource arg expected by retryQbSync. */
function toExpenseSource(
  sourceTable: TruckExpenseSourceTable,
): 'trip' | 'business' | 'fuel' | 'maintenance' {
  switch (sourceTable) {
    case 'trip_expenses':
      return 'trip'
    case 'business_expenses':
      return 'business'
    case 'fuel_entries':
      return 'fuel'
    case 'maintenance_records':
      return 'maintenance'
  }
}

function formatCategoryLabel(category: NormalizedExpenseCategory): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const PAGE_SIZE = 20

export function TruckExpenseLedger({ entries, isLoading, onAddExpense }: TruckExpenseLedgerProps) {
  const queryClient = useQueryClient()
  // Gate the QB retry button on the same permission the retryQbSync
  // server action requires. A user with fuel.create / trip_expenses.create
  // can see an expense row in error state but can't retry it — hiding the
  // button prevents a deceptive "Insufficient permissions" toast.
  const { can: canPermission } = useCurrentUserPermissions()
  const canRetryQB = canPermission('integrations.manage')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [page, setPage] = useState(0)
  // Per-row retry in-flight state keyed by entry.id
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})

  // Reset page to 0 when the entries reference changes (e.g. parent changed
  // the date range). Uses the "adjusting state during render" pattern from
  // React docs — preferred over useEffect(setState, [prop]) because the
  // project lints setState-in-effect strictly and this avoids the re-render
  // cascade.
  const [prevEntries, setPrevEntries] = useState(entries)
  if (prevEntries !== entries) {
    setPrevEntries(entries)
    setPage(0)
  }

  const filtered = useMemo(() => {
    let rows = entries
    if (categoryFilter !== 'all') {
      rows = rows.filter((e) => e.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      rows = rows.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          formatCategoryLabel(e.category).toLowerCase().includes(q),
      )
    }
    return rows
  }, [entries, search, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  const uniqueCategories = useMemo(() => {
    const set = new Set<NormalizedExpenseCategory>()
    for (const e of entries) set.add(e.category)
    return Array.from(set).sort()
  }, [entries])

  async function handleRetry(entry: TruckExpenseEntry) {
    setRetrying((prev) => ({ ...prev, [entry.id]: true }))
    try {
      const result = await retryQbSync({
        expenseId: entry.sourceId,
        expenseSource: toExpenseSource(entry.sourceTable),
        truckId: entry.truckId,
      })
      if ('error' in result && result.error) {
        const msg = typeof result.error === 'string' ? result.error : 'Retry failed'
        toast.error(msg)
        return
      }
      toast.success('Retry queued')
      queryClient.invalidateQueries({ queryKey: ['truck-expenses', entry.truckId] })
    } finally {
      setRetrying((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  return (
    <div className="widget-card">
      <div className="widget-header">
        <h3 className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Expense Ledger
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              aria-label="Search expenses"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              className="h-8 w-[180px] pl-8 text-xs"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch('')
                  setPage(0)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as CategoryFilter)
              setPage(0)
            }}
            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="all">All categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {formatCategoryLabel(c)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={onAddExpense}
            className="h-8 gap-1.5 bg-brand text-white hover:bg-brand/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 py-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-5 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            {entries.length === 0 ? 'No expenses yet' : 'No expenses match the filter'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entries.length === 0
              ? "Start tracking this truck's costs to see true per-truck profitability."
              : 'Try a different search or category filter.'}
          </p>
          {entries.length === 0 && (
            <Button
              size="sm"
              onClick={onAddExpense}
              className="mt-4 gap-1.5 bg-brand text-white hover:bg-brand/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first expense
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                    <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      Category
                    </th>
                    <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      Description
                    </th>
                    <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      Source
                    </th>
                    <th scope="col" className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">
                      QB
                    </th>
                    <th scope="col" className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((entry) => {
                    const isRetrying = retrying[entry.id] === true
                    const qbError =
                      entry.qbSyncError && entry.qbSyncError.length > 100
                        ? entry.qbSyncError.slice(0, 100) + '…'
                        : entry.qbSyncError

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2 pr-3 tabular-nums text-foreground whitespace-nowrap">
                          {formatDate(entry.occurredAt)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                              CATEGORY_BADGE_COLORS[entry.category],
                            )}
                          >
                            {formatCategoryLabel(entry.category)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-foreground max-w-[320px] truncate">
                          {entry.description}
                          {entry.scope === 'business_allocated' && (
                            <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              prorated
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              'inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                              SOURCE_BADGE_STYLES[entry.sourceBadge] ?? SOURCE_BADGE_STYLES.manual,
                            )}
                          >
                            {SOURCE_BADGE_LABELS[entry.sourceBadge] ?? entry.sourceBadge}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {entry.qbSyncStatus === 'n/a' ? (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {entry.qbSyncStatus === 'error' && qbError ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium cursor-default',
                                        QB_BADGE_STYLES[entry.qbSyncStatus],
                                      )}
                                    >
                                      {QB_BADGE_LABELS[entry.qbSyncStatus]}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] text-xs">
                                    {qbError}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span
                                  className={cn(
                                    'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                                    QB_BADGE_STYLES[entry.qbSyncStatus],
                                  )}
                                >
                                  {QB_BADGE_LABELS[entry.qbSyncStatus]}
                                </span>
                              )}
                              {entry.qbSyncStatus === 'error' && canRetryQB && (
                                <button
                                  onClick={() => { void handleRetry(entry) }}
                                  disabled={isRetrying}
                                  aria-label="Retry QuickBooks sync"
                                  className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                                >
                                  {isRetrying ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pl-3 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
                          ${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TooltipProvider>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {clampedPage + 1} of {totalPages} · {filtered.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={clampedPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={clampedPage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
