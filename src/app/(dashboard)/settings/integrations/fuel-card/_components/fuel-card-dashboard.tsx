'use client'

import { useState, useCallback, useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  TrendingUp,
  Flag,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { DateRangePicker } from '@/components/shared/date-range-picker'
import { useTrucks } from '@/hooks/use-trucks'
import {
  getFuelCardTransactions,
  syncFuelTransactions,
  disconnectFuelCard,
  matchTransaction,
  flagTransaction,
  unflagTransaction,
} from '@/app/actions/fuelcard'
import type {
  FuelCardStatusData,
  FuelCardTransactionRow,
} from '@/app/actions/fuelcard'
import type { DateRange } from '@/types/filters'

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatCurrency(raw: string): string {
  const n = parseFloat(raw)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatGallons(raw: string): string {
  const n = parseFloat(raw)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function formatPricePerGallon(raw: string): string {
  const n = parseFloat(raw)
  if (isNaN(n)) return '—'
  return `$${n.toFixed(3)}`
}

// ── Status badge ──────────────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: FuelCardStatusData['syncStatus'] }) {
  if (status === 'active') {
    return (
      <Badge className="gap-1 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </Badge>
    )
  }
  if (status === 'syncing') {
    return (
      <Badge className="gap-1 text-sky-700">
        <RefreshCw className="h-3 w-3 animate-spin" />
        Syncing
      </Badge>
    )
  }
  if (status === 'error') {
    return (
      <Badge className="gap-1 text-rose-700">
        <AlertTriangle className="h-3 w-3" />
        Error
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <X className="h-3 w-3" />
      Disconnected
    </Badge>
  )
}

// ── Match status badge ────────────────────────────────────────────────────────

function MatchBadge({ row }: { row: FuelCardTransactionRow }) {
  if (row.flagged) {
    return (
      <Badge className="gap-1 text-rose-700 text-[11px]">
        <Flag className="h-2.5 w-2.5" />
        Flagged
      </Badge>
    )
  }
  if (row.matchedTruckId) {
    return (
      <Badge className="gap-1 text-emerald-700 text-[11px]">
        <Check className="h-2.5 w-2.5" />
        {row.matchedTruckUnit ?? 'Matched'}
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 text-amber-700 text-[11px]">
      <AlertTriangle className="h-2.5 w-2.5" />
      Unmatched
    </Badge>
  )
}

// ── Match truck dialog ────────────────────────────────────────────────────────

interface MatchTruckDialogProps {
  open: boolean
  transactionId: string | null
  onClose: () => void
  onMatched: () => void
}

function MatchTruckDialog({ open, transactionId, onClose, onMatched }: MatchTruckDialogProps) {
  const queryClient = useQueryClient()
  const { data: trucksResult, isLoading } = useTrucks({ status: 'active' })
  const trucks = trucksResult?.trucks ?? []

  const [selectedTruckId, setSelectedTruckId] = useState('')
  const [saving, setSaving] = useState(false)

  // Reset selection when dialog opens
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) setSelectedTruckId('')
  }

  async function handleMatch() {
    if (!transactionId || !selectedTruckId) return
    setSaving(true)
    const result = await matchTransaction({ transactionId, truckId: selectedTruckId })
    setSaving(false)

    if ('error' in result && result.error) {
      const msg = typeof result.error === 'string' ? result.error : 'Failed to match transaction'
      toast.error(msg)
      return
    }

    toast.success('Transaction matched to truck')
    queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
    onMatched()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>Match to truck</DialogTitle>
              <DialogDescription>
                Select the truck this fuel transaction belongs to.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div>
                <Label htmlFor="truckSelect">Truck</Label>
                <Select value={selectedTruckId} onValueChange={setSelectedTruckId}>
                  <SelectTrigger id="truckSelect" className="mt-1.5">
                    <SelectValue placeholder={isLoading ? 'Loading trucks…' : 'Select a truck'} />
                  </SelectTrigger>
                  <SelectContent>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.unit_number}
                        {truck.make ? ` — ${truck.make} ${truck.model ?? ''}`.trim() : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMatch}
                  disabled={saving || !selectedTruckId}
                  className="bg-brand text-white hover:bg-brand/90"
                >
                  {saving ? 'Matching…' : 'Match'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Flag dialog ───────────────────────────────────────────────────────────────

interface FlagDialogProps {
  open: boolean
  transactionId: string | null
  onClose: () => void
  onFlagged: () => void
}

function FlagDialog({ open, transactionId, onClose, onFlagged }: FlagDialogProps) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Reset on open
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setReason('')
      setFieldError(null)
    }
  }

  async function handleFlag() {
    if (!transactionId) return
    if (!reason.trim()) {
      setFieldError('Reason is required')
      return
    }
    setSaving(true)
    setFieldError(null)
    const result = await flagTransaction({ transactionId, reason: reason.trim() })
    setSaving(false)

    if ('error' in result && result.error) {
      const msg = typeof result.error === 'string' ? result.error : 'Failed to flag transaction'
      toast.error(msg)
      return
    }

    toast.success('Transaction flagged')
    queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
    onFlagged()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>Flag transaction</DialogTitle>
              <DialogDescription>
                Describe why this transaction looks suspicious or incorrect.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div>
                <Label htmlFor="flagReason">Reason</Label>
                <Textarea
                  id="flagReason"
                  rows={3}
                  placeholder="e.g. Unusual location, wrong product type, duplicate…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5"
                />
                {fieldError && (
                  <p className="mt-1 text-xs text-rose-600">{fieldError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleFlag}
                  disabled={saving || !reason.trim()}
                  className="bg-rose-600 text-white hover:bg-rose-700"
                >
                  {saving ? 'Flagging…' : 'Flag transaction'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

interface FuelCardDashboardProps {
  status: FuelCardStatusData
  onDisconnected: () => void
}

export function FuelCardDashboard({ status, onDisconnected }: FuelCardDashboardProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()
  // React-stable unique ID scoped to this component instance. Used to
  // namespace the Supabase Realtime channel so two tabs (or two tenants
  // on the same browser profile) don't share a channel name and trigger
  // each other's `invalidateQueries` on unrelated writes.
  const channelId = useId()

  // Filter state
  const [page, setPage] = useState(1)
  const [matchFilter, setMatchFilter] = useState<'all' | 'matched' | 'unmatched'>('all')
  const [flaggedFilter, setFlaggedFilter] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Dialog state
  const [syncing, setSyncing] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [matchDialogTxId, setMatchDialogTxId] = useState<string | null>(null)
  const [flagDialogTxId, setFlagDialogTxId] = useState<string | null>(null)

  // Transactions query
  const txQuery = useQuery({
    queryKey: [
      'fuel-card-transactions',
      page,
      matchFilter,
      flaggedFilter,
      dateRange?.from,
      dateRange?.to,
    ],
    queryFn: async () => {
      const result = await getFuelCardTransactions({
        page,
        pageSize: PAGE_SIZE,
        matched: matchFilter,
        flagged: flaggedFilter,
        startDate: dateRange ? dateRange.from.split('T')[0] : undefined,
        endDate: dateRange ? dateRange.to.split('T')[0] : undefined,
      })
      if ('error' in result) throw new Error(result.error)
      return result.data
    },
    staleTime: 30_000,
  })

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`fuelcard-dashboard-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuelcard_integrations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuelcard_transactions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
          queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, channelId])

  // Reset page when filters change
  const handleMatchFilterChange = useCallback((val: string) => {
    setMatchFilter(val as 'all' | 'matched' | 'unmatched')
    setPage(1)
  }, [])

  const handleFlaggedToggle = useCallback(() => {
    setFlaggedFilter((prev) => !prev)
    setPage(1)
  }, [])

  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    setDateRange(range)
    setPage(1)
  }, [])

  // Sync handler
  async function handleSync() {
    setSyncing(true)
    const result = await syncFuelTransactions()
    setSyncing(false)

    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Sync failed')
      return
    }

    if ('data' in result && result.data) {
      const { synced, matched, flagged } = result.data
      toast.success(`Synced ${synced} transaction${synced !== 1 ? 's' : ''} — ${matched} matched, ${flagged} flagged`)
    } else {
      toast.success('Sync complete')
    }
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
  }

  // Disconnect handler
  async function handleDisconnect() {
    setDisconnecting(true)
    const result = await disconnectFuelCard()
    setDisconnecting(false)

    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to disconnect')
      return
    }

    toast.success('Fuel card disconnected. Transaction history preserved.')
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
    onDisconnected()
  }

  // Unflag handler (inline — no dialog needed)
  async function handleUnflag(transactionId: string) {
    const result = await unflagTransaction({ transactionId })
    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to unflag')
      return
    }
    toast.success('Flag removed')
    queryClient.invalidateQueries({ queryKey: ['fuel-card-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
  }

  const transactions: FuelCardTransactionRow[] = txQuery.data?.transactions ?? []
  const total = txQuery.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* ── Status overview card ── */}
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Multi Service Fuel Card
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || status.syncStatus === 'syncing'}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync now
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectOpen(true)}
              className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700"
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <SyncStatusBadge status={status.syncStatus} />
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Last sync
            </span>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {formatRelativeTime(status.lastSync)}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-2.5 w-2.5" />
              Transactions
            </span>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {status.transactionCount.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-2.5 w-2.5" />
              Match rate
            </span>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {status.matchRate}%
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Flag className="h-2.5 w-2.5" />
              Flagged
            </span>
            <span className={`text-sm font-medium tabular-nums ${status.flaggedCount > 0 ? 'text-rose-600' : 'text-foreground'}`}>
              {status.flaggedCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Error banner */}
        {status.syncError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Last sync error: {status.syncError}</span>
          </div>
        )}
      </div>

      {/* ── Transactions table card ── */}
      <div className="widget-card">
        <div className="widget-header">
          <h3 className="widget-title">
            <span className="widget-accent-dot bg-brand" />
            Transactions
            {total > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
                ({total.toLocaleString()})
              </span>
            )}
          </h3>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={matchFilter} onValueChange={handleMatchFilterChange}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transactions</SelectItem>
              <SelectItem value="matched">Matched only</SelectItem>
              <SelectItem value="unmatched">Unmatched only</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={flaggedFilter ? 'default' : 'outline'}
            size="sm"
            onClick={handleFlaggedToggle}
            className={`h-8 gap-1.5 text-xs ${flaggedFilter ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600' : ''}`}
          >
            <Flag className="h-3 w-3" />
            Flagged
          </Button>

          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder="Date range"
          />

          {(matchFilter !== 'all' || flaggedFilter || dateRange) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setMatchFilter('all')
                setFlaggedFilter(false)
                setDateRange(undefined)
                setPage(1)
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        {txQuery.isLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        ) : txQuery.isError ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-4 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load transactions. Please try again.
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center">
            <CreditCard className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No transactions found</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Try adjusting your filters or sync to pull the latest data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Card</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Driver</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Vehicle</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Product</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Gal</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">$/gal</th>
                  <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Location</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <TransactionRow
                    key={row.id}
                    row={row}
                    onMatchClick={() => setMatchDialogTxId(row.id)}
                    onFlagClick={() => setFlagDialogTxId(row.id)}
                    onUnflag={() => handleUnflag(row.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {totalPages} — {total.toLocaleString()} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || txQuery.isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || txQuery.isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect fuel card?"
        description="This removes the integration. Your existing transaction history is preserved and remains accessible."
        confirmLabel={disconnecting ? 'Disconnecting…' : 'Disconnect'}
        destructive
        onConfirm={handleDisconnect}
      />

      <MatchTruckDialog
        open={matchDialogTxId !== null}
        transactionId={matchDialogTxId}
        onClose={() => setMatchDialogTxId(null)}
        onMatched={() => setMatchDialogTxId(null)}
      />

      <FlagDialog
        open={flagDialogTxId !== null}
        transactionId={flagDialogTxId}
        onClose={() => setFlagDialogTxId(null)}
        onFlagged={() => setFlagDialogTxId(null)}
      />
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

interface TransactionRowProps {
  row: FuelCardTransactionRow
  onMatchClick: () => void
  onFlagClick: () => void
  onUnflag: () => void
}

function TransactionRow({ row, onMatchClick, onFlagClick, onUnflag }: TransactionRowProps) {
  const dateStr = new Date(row.transactionDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })

  const location = [row.city, row.state].filter(Boolean).join(', ') || row.locationName || '—'
  const cardLast4 = row.cardNumber.length > 4 ? `••${row.cardNumber.slice(-4)}` : row.cardNumber

  return (
    <tr className="border-b border-border-subtle/50 last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2 pr-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {dateStr}
      </td>
      <td className="py-2 px-3 text-xs font-mono text-foreground tabular-nums">
        {cardLast4}
      </td>
      <td className="py-2 px-3 text-xs text-foreground max-w-[100px] truncate">
        {row.matchedDriverName ?? row.driverName ?? '—'}
      </td>
      <td className="py-2 px-3 text-xs text-foreground">
        {row.matchedTruckUnit ?? row.vehicleUnit ?? '—'}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground capitalize">
        {row.productType.replace(/_/g, ' ').toLowerCase()}
      </td>
      <td className="py-2 px-3 text-right text-xs tabular-nums text-foreground">
        {formatGallons(row.gallons)}
      </td>
      <td className="py-2 px-3 text-right text-xs tabular-nums text-muted-foreground">
        {formatPricePerGallon(row.pricePerGallon)}
      </td>
      <td className="py-2 px-3 text-right text-xs tabular-nums font-medium text-foreground">
        {formatCurrency(row.totalAmount)}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[120px] truncate">
        {location}
      </td>
      <td className="py-2 px-3">
        <MatchBadge row={row} />
      </td>
      <td className="py-2 pl-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {!row.matchedTruckId && !row.flagged && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onMatchClick}
            >
              Match
            </Button>
          )}
          {!row.flagged && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-rose-600"
              onClick={onFlagClick}
            >
              Flag
            </Button>
          )}
          {row.flagged && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onUnflag}
            >
              Unflag
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
