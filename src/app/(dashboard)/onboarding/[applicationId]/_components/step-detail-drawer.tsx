'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from 'sonner'
import { updateStepStatus, waiveStep } from '@/app/actions/driver-onboarding'
import {
  ONBOARDING_STEP_KEY_LABELS,
  ONBOARDING_STEP_KEY_REG_CITES,
} from '@/types'
import type { DriverOnboardingStep } from '@/types/database'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  step: DriverOnboardingStep | null
  applicationId: string
}

export function StepDetailDrawer({ open, onOpenChange, step, applicationId }: Props) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [waiveReason, setWaiveReason] = useState('')

  // Sync notes when step changes
  useEffect(() => {
    setNotes(step?.notes ?? '')
    setWaiveReason('')
  }, [step])

  if (!step) return null

  const label = ONBOARDING_STEP_KEY_LABELS[step.step_key] ?? step.step_key
  const regCite = ONBOARDING_STEP_KEY_REG_CITES[step.step_key] ?? ''

  async function handleTransition(newStatus: string) {
    if (!step) return
    setBusy(true)
    try {
      const result = await updateStepStatus(step.id, newStatus, notes || undefined)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success(`Step marked ${newStatus}`)
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveNotes() {
    if (!step) return
    setBusy(true)
    try {
      const result = await updateStepStatus(step.id, step.status, notes || undefined)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Notes saved')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleWaive() {
    if (!step) return
    if (!waiveReason.trim()) {
      toast.error('Waive reason required')
      return
    }
    setBusy(true)
    try {
      const result = await waiveStep(step.id, waiveReason)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Step waived')
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  const isTerminal = ['passed', 'failed', 'waived', 'not_applicable'].includes(step.status)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{label}</SheetTitle>
          {regCite && (
            <p className="text-xs font-mono text-muted-foreground">{regCite}</p>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {/* Current status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Current status:</span>
            <StatusBadge type="onboarding_step" status={step.status} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            {step.started_at && (
              <div>
                <p className="font-medium text-foreground">Started</p>
                <p>{new Date(step.started_at).toLocaleDateString()}</p>
              </div>
            )}
            {step.completed_at && (
              <div>
                <p className="font-medium text-foreground">Completed</p>
                <p>{new Date(step.completed_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="step-notes" className="text-xs font-medium">
              Notes
            </Label>
            <Textarea
              id="step-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this step..."
              rows={4}
              className="text-sm resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSaveNotes}
              disabled={busy}
            >
              Save Notes
            </Button>
          </div>

          {/* Status transition buttons */}
          {!isTerminal && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Transition Status</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleTransition('in_progress')}
                  disabled={busy || step.status === 'in_progress'}
                >
                  In Progress
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => handleTransition('passed')}
                  disabled={busy}
                >
                  Mark Passed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleTransition('failed')}
                  disabled={busy}
                >
                  Mark Failed
                </Button>
              </div>
            </div>
          )}

          {/* Waive section */}
          {step.waivable && !isTerminal && (
            <div className="space-y-2 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <p className="text-xs font-medium text-purple-800">Waive this step</p>
              <p className="text-xs text-purple-700">
                Waiving is only permitted when a legitimate FMCSA exception applies (e.g., CDL substitution under § 391.33).
              </p>
              <Textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Provide waiver justification (required)..."
                rows={2}
                className="text-xs resize-none border-purple-200 focus:border-purple-400"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-purple-600 border-purple-200 hover:bg-purple-100"
                onClick={handleWaive}
                disabled={busy || !waiveReason.trim()}
              >
                Waive Step
              </Button>
            </div>
          )}

          {/* Waive reason display */}
          {step.status === 'waived' && step.waive_reason && (
            <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3 text-xs">
              <p className="font-medium text-purple-800 mb-1">Waiver reason</p>
              <p className="text-purple-700">{step.waive_reason}</p>
            </div>
          )}

          {/* Document upload note */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            To attach a result document (MVR, drug test, etc.), go to the Documents tab and upload with the appropriate DQF sub-category.
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
