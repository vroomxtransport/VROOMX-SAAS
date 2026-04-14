'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Mail } from 'lucide-react'
import type { PaymentStatus } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ReceiptRecipient } from '@/lib/validations/receipt'

interface ReceiptDialogProps {
  orderId: string
  orderNumber: string | null
  paymentStatus: PaymentStatus
  pickupContact: { name: string | null; email: string | null }
  deliveryContact: { name: string | null; email: string | null }
  broker: { name: string | null; email: string | null } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RECIPIENT_OPTIONS: ReadonlyArray<{
  value: ReceiptRecipient
  label: string
  sub: (
    p: Pick<ReceiptDialogProps, 'pickupContact' | 'deliveryContact' | 'broker'>,
  ) => string
}> = [
  {
    value: 'pickup',
    label: 'Pickup contact',
    sub: (p) => p.pickupContact.name ?? 'No contact on file',
  },
  {
    value: 'delivery',
    label: 'Delivery contact',
    sub: (p) => p.deliveryContact.name ?? 'No contact on file',
  },
  {
    value: 'broker',
    label: 'Broker',
    sub: (p) => p.broker?.name ?? 'No broker on file',
  },
]

function resolveDefaultEmail(
  choice: ReceiptRecipient,
  pickup: ReceiptDialogProps['pickupContact'],
  delivery: ReceiptDialogProps['deliveryContact'],
  broker: ReceiptDialogProps['broker'],
): string {
  if (choice === 'pickup') return pickup.email ?? ''
  if (choice === 'delivery') return delivery.email ?? ''
  return broker?.email ?? ''
}

export function ReceiptDialog({
  orderId,
  orderNumber,
  paymentStatus,
  pickupContact,
  deliveryContact,
  broker,
  open,
  onOpenChange,
}: ReceiptDialogProps) {
  const queryClient = useQueryClient()
  const [recipient, setRecipient] = useState<ReceiptRecipient>('broker')
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state and prefill email when the dialog transitions to open.
  // Depend on primitive fields rather than object identity: the parent
  // reconstructs pickupContact/deliveryContact/broker on every render, and
  // depending on the object references would re-fire this effect and stomp
  // user edits whenever the parent re-renders.
  const pickupEmail = pickupContact.email
  const pickupName = pickupContact.name
  const deliveryEmail = deliveryContact.email
  const deliveryName = deliveryContact.name
  const brokerEmail = broker?.email ?? null
  const brokerName = broker?.name ?? null
  useEffect(() => {
    if (!open) return
    setRecipient('broker')
    setEmail(brokerEmail ?? '')
    setError(null)
    // brokerEmail is the prefill for the default 'broker' recipient; the
    // other primitives are included so the effect re-runs if the order
    // data actually changes while the dialog is open (e.g. a realtime
    // refetch updates a contact email).
  }, [open, brokerEmail, brokerName, pickupEmail, pickupName, deliveryEmail, deliveryName])

  const handleRecipientChange = (next: ReceiptRecipient) => {
    setRecipient(next)
    setEmail(resolveDefaultEmail(next, pickupContact, deliveryContact, broker))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSending(true)
    try {
      const res = await fetch(`/api/receipts/${orderId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient, email }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          fieldErrors?: Record<string, string[]>
        }
        const fieldErr = data.fieldErrors?.email?.[0]
        throw new Error(fieldErr ?? data.error ?? 'Failed to send receipt')
      }

      toast.success(`Receipt sent to ${email}`)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send receipt')
    } finally {
      setIsSending(false)
    }
  }

  const notPaidWarning = paymentStatus !== 'paid'
  const orderRef = orderNumber ?? orderId.slice(0, 8).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send payment receipt</DialogTitle>
          <DialogDescription>
            Email a PAID receipt PDF for order {orderRef}. Choose the recipient
            and confirm the email address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Send to
            </legend>
            <div className="grid grid-cols-1 gap-2">
              {RECIPIENT_OPTIONS.map((opt) => {
                const isSelected = recipient === opt.value
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="receipt-recipient"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => handleRecipientChange(opt.value)}
                      className="mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {opt.sub({ pickupContact, deliveryContact, broker })}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="receipt-email">Email address</Label>
            <Input
              id="receipt-email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Prefilled from order data when available. You can override before
              sending.
            </p>
          </div>

          {notPaidWarning && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              This order is not marked <strong>paid</strong> yet. The receipt
              will still show status PAID — send only after payment is
              actually received.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {isSending ? 'Sending…' : 'Send receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
