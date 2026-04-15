'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { sendPreAdverseAction, finalizeRejection } from '@/app/actions/driver-onboarding'
import { countBusinessDays } from '@/lib/business-days'
import { ONBOARDING_STEP_KEY_LABELS } from '@/types'
import type { DriverApplication, DriverOnboardingStep } from '@/types/database'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  application: DriverApplication
  steps: DriverOnboardingStep[]
}

export function AdverseActionModal({ open, onOpenChange, applicationId, application, steps }: Props) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  // Stage 1 state
  const [selectedFailedSteps, setSelectedFailedSteps] = useState<string[]>([])
  const [findingsSummary, setFindingsSummary] = useState('')

  // Stage 2 state
  const [finalReason, setFinalReason] = useState('')

  const failedSteps = steps.filter((s) => s.status === 'failed')
  const hasPreAdverse = !!application.pre_adverse_sent_at

  // Business days elapsed since pre-adverse notice (uses shared countBusinessDays — UTC-based, FCRA-aligned)
  const businessDaysElapsed = hasPreAdverse
    ? countBusinessDays(new Date(application.pre_adverse_sent_at!), new Date())
    : 0
  const canFinalize = businessDaysElapsed >= 5

  function toggleStep(stepId: string) {
    setSelectedFailedSteps((prev) =>
      prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]
    )
  }

  // Pre-populate findings summary when failed steps change
  function buildDefaultSummary(stepIds: string[]): string {
    return stepIds
      .map((id) => {
        const step = steps.find((s) => s.id === id)
        if (!step) return ''
        const label = ONBOARDING_STEP_KEY_LABELS[step.step_key] ?? step.step_key
        return `${label}${step.notes ? `: ${step.notes}` : ''}`
      })
      .filter(Boolean)
      .join('\n')
  }

  async function handleSendPreAdverse() {
    if (selectedFailedSteps.length === 0) {
      toast.error('Select at least one failed step')
      return
    }
    if (findingsSummary.trim().length < 10) {
      toast.error('Findings summary required', {
        description: 'Please provide at least 10 characters describing the findings.',
      })
      return
    }
    setBusy(true)
    try {
      const result = await sendPreAdverseAction(applicationId, selectedFailedSteps, findingsSummary.trim())
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        toast.success('Pre-adverse notice sent', {
          description: 'You must wait at least 5 business days before finalizing rejection.',
        })
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleFinalizeRejection() {
    if (!canFinalize) {
      toast.error('Waiting period not met', {
        description: 'You must wait at least 5 business days after the pre-adverse notice.',
      })
      return
    }
    if (finalReason.trim().length < 10) {
      toast.error('Rejection reason required', {
        description: 'Please provide at least 10 characters for FCRA compliance.',
      })
      return
    }
    setBusy(true)
    try {
      const result = await finalizeRejection(applicationId, finalReason.trim())
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        toast.success('Application rejected', { description: 'Adverse-action notice has been sent.' })
        onOpenChange(false)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {!hasPreAdverse ? (
          // ── Stage 1: Pre-adverse notice ──────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Send Pre-Adverse Action Notice</DialogTitle>
            </DialogHeader>

            {/* FCRA explainer */}
            <div className="rounded-lg border border-amber-200 p-3 text-xs text-amber-800 flex gap-2">
              <HugeiconsIcon icon={Alert01Icon} size={14} className="shrink-0 mt-0.5" />
              <p>
                Under <strong>FCRA § 1681b(b)(3)</strong>, before taking adverse action you must
                provide the applicant with a copy of the consumer report and a summary of their
                rights. After sending this notice, you must wait <strong>at least 5 business days</strong> before
                finalizing rejection.
              </p>
            </div>

            {/* Failed steps selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Basis for adverse action (select failed steps)
              </Label>
              {failedSteps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No failed steps found. Mark steps as failed in the Pipeline tab before proceeding.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2">
                  {failedSteps.map((step) => (
                    <div key={step.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`step-${step.id}`}
                        checked={selectedFailedSteps.includes(step.id)}
                        onCheckedChange={() => {
                          toggleStep(step.id)
                          if (!findingsSummary || findingsSummary === buildDefaultSummary(selectedFailedSteps)) {
                            const next = selectedFailedSteps.includes(step.id)
                              ? selectedFailedSteps.filter((id) => id !== step.id)
                              : [...selectedFailedSteps, step.id]
                            setFindingsSummary(buildDefaultSummary(next))
                          }
                        }}
                        className="mt-0.5"
                      />
                      <label htmlFor={`step-${step.id}`} className="text-xs cursor-pointer">
                        <span className="font-medium">
                          {ONBOARDING_STEP_KEY_LABELS[step.step_key] ?? step.step_key}
                        </span>
                        {step.notes && (
                          <span className="block text-muted-foreground mt-0.5 line-clamp-1">
                            {step.notes}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Findings summary */}
            <div className="space-y-1.5">
              <Label htmlFor="findings" className="text-xs font-medium">
                Summary of findings
              </Label>
              <Textarea
                id="findings"
                value={findingsSummary}
                onChange={(e) => setFindingsSummary(e.target.value)}
                placeholder="Describe the findings that form the basis of the adverse action..."
                rows={4}
                minLength={10}
                maxLength={4000}
                className="text-xs resize-none"
              />
            </div>

            {/* Wait period warning */}
            <div className="rounded-lg border border-red-200 p-3 text-xs text-red-800">
              After sending this notice, the applicant has the right to dispute the findings.
              You <strong>must wait at least 5 business days</strong> before finalizing the rejection.
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleSendPreAdverse}
                disabled={busy || selectedFailedSteps.length === 0}
              >
                {busy ? 'Sending...' : 'Send Pre-Adverse Notice'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // ── Stage 2: Finalize rejection ──────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Finalize Rejection</DialogTitle>
            </DialogHeader>

            {/* Elapsed days indicator */}
            <div
              className={`rounded-lg border p-3 text-xs flex gap-2 ${
                canFinalize
                  ? 'border-green-200 text-green-800'
                  : 'border-amber-200 text-amber-800'
              }`}
            >
              <HugeiconsIcon icon={Alert01Icon} size={14} className="shrink-0 mt-0.5" />
              <p>
                Pre-adverse notice sent on{' '}
                <strong>
                  {new Date(application.pre_adverse_sent_at!).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </strong>
                .{' '}
                {canFinalize ? (
                  <span className="font-medium">
                    {businessDaysElapsed} business days have elapsed. You may now finalize.
                  </span>
                ) : (
                  <span className="font-medium text-amber-900">
                    {businessDaysElapsed} of 5 required business days have elapsed.
                    Please wait before finalizing.
                  </span>
                )}
              </p>
            </div>

            {/* Final rejection reason */}
            <div className="space-y-1.5">
              <Label htmlFor="final-reason" className="text-xs font-medium">
                Final rejection reason
              </Label>
              <Textarea
                id="final-reason"
                value={finalReason}
                onChange={(e) => setFinalReason(e.target.value)}
                placeholder="Provide the final reason for rejection (will appear in adverse-action notice)..."
                rows={4}
                minLength={10}
                maxLength={4000}
                className="text-xs resize-none"
                disabled={!canFinalize}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleFinalizeRejection}
                disabled={busy || !canFinalize || finalReason.trim().length < 10}
              >
                {busy ? 'Rejecting...' : 'Finalize Rejection'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
