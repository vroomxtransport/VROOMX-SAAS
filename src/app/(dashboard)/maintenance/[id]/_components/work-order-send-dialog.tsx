'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface WorkOrderSendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: string
  woNumber: number | null
  defaultRecipient: string | null
}

export function WorkOrderSendDialog({
  open,
  onOpenChange,
  workOrderId,
  woNumber,
  defaultRecipient,
}: WorkOrderSendDialogProps) {
  const [recipientsText, setRecipientsText] = useState(defaultRecipient ?? '')
  const [subject, setSubject] = useState('')
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string | null>(null)

  function reset() {
    setRecipientsText(defaultRecipient ?? '')
    setSubject('')
    setErrors(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors(null)
    const recipients = recipientsText
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      setErrors('Enter at least one recipient email.')
      return
    }
    if (recipients.length > 10) {
      setErrors('Maximum 10 recipients per send.')
      return
    }

    startTransition(async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: workOrderId,
          recipients,
          subject: subject.trim() || undefined,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        error?: string
        fieldErrors?: Record<string, string[]>
      } | null

      if (!res.ok || !json?.success) {
        const msg =
          json?.error ??
          (json?.fieldErrors ? Object.values(json.fieldErrors)[0]?.[0] : null) ??
          'Failed to send work order.'
        setErrors(msg)
        toast.error(msg)
        return
      }
      toast.success(`Work Order ${woNumber ?? ''} sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}.`)
      reset()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isPending) { onOpenChange(next); if (!next) reset() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Work Order {woNumber ? `#${woNumber}` : ''}</DialogTitle>
          <DialogDescription>
            The PDF is attached automatically. Separate multiple emails with a comma or space.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipients">Recipients</Label>
            <Input
              id="recipients"
              type="text"
              placeholder="name@shop.com, accounting@vendor.com"
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject (optional)</Label>
            <Input
              id="subject"
              type="text"
              placeholder={`Work Order ${woNumber ? `#${woNumber}` : ''}`}
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          {errors && (
            <p className="text-xs text-destructive">{errors}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
