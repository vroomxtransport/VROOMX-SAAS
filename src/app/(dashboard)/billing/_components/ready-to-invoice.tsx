'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchReadyToInvoice, type ReadyToInvoiceOrder } from '@/lib/queries/receivables'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Send, Loader2, CheckCircle2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function ReadyToInvoice() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [batchSending, setBatchSending] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ sent: 0, total: 0 })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ready-to-invoice'],
    queryFn: () => fetchReadyToInvoice(supabase),
    staleTime: 30_000,
  })

  // Realtime invalidation
  useEffect(() => {
    const channel = supabase
      .channel('ready-to-invoice-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ready-to-invoice'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (!orders) return
    setSelectedIds((prev) => {
      if (prev.size === orders.length) return new Set()
      return new Set(orders.map((o) => o.id))
    })
  }, [orders])

  const handleSendInvoice = useCallback(async (orderId: string) => {
    setSendingId(orderId)
    try {
      const res = await fetch(`/api/invoices/${orderId}/send`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to send invoice')
      }
      toast.success('Invoice sent')
      queryClient.invalidateQueries({ queryKey: ['ready-to-invoice'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invoice')
    } finally {
      setSendingId(null)
    }
  }, [queryClient])

  const handleBatchSend = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBatchSending(true)
    setBatchProgress({ sent: 0, total: ids.length })

    const results = await Promise.allSettled(
      ids.map(async (orderId, index) => {
        const res = await fetch(`/api/invoices/${orderId}/send`, { method: 'POST' })
        setBatchProgress((prev) => ({ ...prev, sent: index + 1 }))
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(body.error ?? `Failed for ${orderId}`)
        }
        return orderId
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (failed === 0) {
      toast.success(`Sent ${succeeded} invoice${succeeded !== 1 ? 's' : ''}`)
    } else {
      toast.warning(`Sent ${succeeded} of ${ids.length}. ${failed} failed.`)
    }

    setBatchSending(false)
    setSelectedIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['ready-to-invoice'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }, [selectedIds, queryClient])

  if (isLoading) return null

  const count = orders?.length ?? 0
  if (count === 0) return null

  const allSelected = count > 0 && selectedIds.size === count
  const someSelected = selectedIds.size > 0 && selectedIds.size < count

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Ready to Invoice</h2>
          <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
            {count}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <Button
            size="sm"
            onClick={handleBatchSend}
            disabled={batchSending}
          >
            {batchSending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Sending {batchProgress.sent}/{batchProgress.total}...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Send {selectedIds.size} Invoice{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border-subtle bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <div className="w-6 shrink-0">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
            />
          </div>
          <div className="w-20 shrink-0">Order #</div>
          <div className="w-36 shrink-0">Vehicle</div>
          <div className="w-28 shrink-0">Broker</div>
          <div className="min-w-0 flex-1 hidden md:block">Route</div>
          <div className="w-24 shrink-0 text-right">Amount</div>
          <div className="w-20 shrink-0 text-right hidden sm:block">Delivered</div>
          <div className="w-28 shrink-0 text-right">Action</div>
        </div>

        {/* Order rows */}
        {orders?.map((order) => {
          const isSelected = selectedIds.has(order.id)
          const isSending = sendingId === order.id
          const hasBrokerEmail = !!order.broker?.email

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-4 px-4 py-3 border-b border-border-subtle last:border-b-0 transition-colors',
                isSelected && 'bg-blue-50/50 dark:bg-blue-950/10'
              )}
            >
              <div className="w-6 shrink-0">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(order.id)}
                />
              </div>
              <div className="w-20 shrink-0 text-sm font-medium text-foreground">
                {order.orderNumber ?? 'N/A'}
              </div>
              <div className="w-36 shrink-0 text-sm text-muted-foreground truncate" title={order.vehicleName}>
                {order.vehicleName}
              </div>
              <div className="w-28 shrink-0 text-sm text-muted-foreground truncate" title={order.broker?.name ?? 'No broker'}>
                {order.broker?.name ?? 'No broker'}
              </div>
              <div className="min-w-0 flex-1 text-sm text-muted-foreground truncate hidden md:block" title={order.route}>
                {order.route}
              </div>
              <div className="w-24 shrink-0 text-sm font-semibold text-foreground text-right">
                {formatCurrency(order.carrierPay)}
              </div>
              <div className="w-20 shrink-0 text-xs text-muted-foreground text-right hidden sm:block">
                {formatDate(order.updatedAt)}
              </div>
              <div className="w-28 shrink-0 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendInvoice(order.id)}
                  disabled={isSending || !hasBrokerEmail || batchSending}
                  title={!hasBrokerEmail ? 'Broker email required' : undefined}
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Invoice
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
