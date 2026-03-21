'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { resolveSafetyEvent } from '@/app/actions/safety-events'
import { CheckCircle2 } from 'lucide-react'
import type { SafetyEvent } from '@/types/database'

interface ResolveDialogProps {
  event: SafetyEvent
  onClose: () => void
}

export function ResolveDialog({ event, onClose }: ResolveDialogProps) {
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await resolveSafetyEvent(event.id, resolutionNotes)

    if ('error' in result && result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Failed to resolve event.')
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Resolve Event
          </DialogTitle>
          <DialogDescription>
            Mark <span className="font-medium">&ldquo;{event.title}&rdquo;</span> as resolved.
            Add any notes about how this was resolved.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolutionNotes">Resolution Notes</Label>
            <Textarea
              id="resolutionNotes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Describe how this event was resolved, corrective actions taken, or final outcome..."
              rows={4}
              maxLength={5000}
              autoFocus
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? 'Resolving...' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
