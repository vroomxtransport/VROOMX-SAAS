'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { batchMarkPaid } from '@/app/actions/payments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Send, CheckCircle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BatchActionsProps {
  selectedOrderIds: string[]
  onClear: () => void
}

export function BatchActions({ selectedOrderIds, onClear }: BatchActionsProps) {
  const router = useRouter()
  const [sendingInvoices, setSendingInvoices] = useState(false)
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 })
  const [markingPaid, setMarkingPaid] = useState(false)
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleBatchSendInvoices = useCallback(async () => {
    setSendingInvoices(true)
    const total = selectedOrderIds.length
    setSendProgress({ sent: 0, total })

    const results = await Promise.allSettled(
      selectedOrderIds.map(async (orderId, index) => {
        const res = await fetch(`/api/invoices/${orderId}/send`, {
          method: 'POST',
        })

        setSendProgress((prev) => ({
          ...prev,
          sent: index + 1,
        }))

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(body.error ?? `Failed to send invoice for ${orderId}`)
        }

        return orderId
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (failed === 0) {
      toast.success(`Sent ${succeeded} invoice${succeeded !== 1 ? 's' : ''} successfully`)
    } else {
      toast.warning(
        `Sent ${succeeded} of ${total} invoices. ${failed} failed.`
      )
    }

    setSendingInvoices(false)
    onClear()
    router.refresh()
  }, [selectedOrderIds, onClear, router])

  const handleBatchMarkPaid = useCallback(async () => {
    setMarkingPaid(true)

    const result = await batchMarkPaid(selectedOrderIds, paymentDate)

    if ('error' in result && result.error) {
      toast.error(typeof result.error === 'string' ? result.error : 'Failed to mark as paid')
      setMarkingPaid(false)
      return
    }

    if ('processed' in result) {
      toast.success(
        `Marked ${result.processed} of ${result.total} order${result.total !== 1 ? 's' : ''} as paid`
      )
    }

    setMarkingPaid(false)
    setPopoverOpen(false)
    onClear()
    router.refresh()
  }, [selectedOrderIds, paymentDate, onClear, router])

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-2.5">
      <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
        {selectedOrderIds.length} order
        {selectedOrderIds.length !== 1 ? 's' : ''} selected
      </span>

      <div className="ml-auto flex items-center gap-2">
        {/* Send Invoices */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleBatchSendInvoices}
          disabled={sendingInvoices || markingPaid}
          className="bg-surface"
        >
          {sendingInvoices ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Sending {sendProgress.sent}/{sendProgress.total}...
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send Invoices
            </>
          )}
        </Button>

        {/* Mark Paid */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={sendingInvoices || markingPaid}
              className="bg-surface"
            >
              {markingPaid ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  Mark Paid
                </>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-3">
              <div>
                <Label htmlFor="payment-date" className="text-sm font-medium">
                  Payment Date
                </Label>
                <Input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will record full payment for{' '}
                {selectedOrderIds.length} order
                {selectedOrderIds.length !== 1 ? 's' : ''}.
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={handleBatchMarkPaid}
                disabled={markingPaid}
              >
                {markingPaid ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Mark Paid'
                )}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Selection */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={sendingInvoices || markingPaid}
          className="text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
