'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Time01Icon,
  MoreVerticalIcon,
  DocumentAttachmentIcon,
  UserCheck01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { updateStepStatus, waiveStep } from '@/app/actions/driver-onboarding'
import { ONBOARDING_STEP_KEY_LABELS, ONBOARDING_STEP_KEY_REG_CITES } from '@/types'
import { StepDetailDrawer } from './step-detail-drawer'
import type { DriverOnboardingPipeline, DriverOnboardingStep } from '@/types/database'

interface Props {
  pipeline: DriverOnboardingPipeline & { steps: DriverOnboardingStep[] }
  applicationId: string
}

type StepStatus = DriverOnboardingStep['status']

function StepCircle({ status }: { status: StepStatus }) {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs font-semibold ring-2 ring-background'

  if (status === 'passed' || status === 'waived' || status === 'not_applicable') {
    return (
      <span className={cn(base, 'bg-green-500')}>
        <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={cn(base, 'bg-red-500')}>
        <HugeiconsIcon icon={Cancel01Icon} size={14} />
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className={cn(base, 'bg-amber-400')}>
        <HugeiconsIcon icon={Loading03Icon} size={14} />
      </span>
    )
  }
  // pending
  return (
    <span className={cn(base, 'bg-gray-200 ring-gray-100')}>
      <HugeiconsIcon icon={Time01Icon} size={14} className="text-gray-500" />
    </span>
  )
}

function StepRow({
  step,
  index,
  applicationId,
  onOpen,
}: {
  step: DriverOnboardingStep
  index: number
  applicationId: string
  onOpen: (step: DriverOnboardingStep) => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  async function transition(newStatus: string) {
    setBusy(true)
    try {
      const result = await updateStepStatus(step.id, newStatus)
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success(`Step marked ${newStatus}`)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleWaive() {
    setBusy(true)
    try {
      const result = await waiveStep(step.id, 'Waived by admin')
      if ('error' in result) {
        toast.error('Failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Step waived')
      }
    } finally {
      setBusy(false)
    }
  }

  const label = ONBOARDING_STEP_KEY_LABELS[step.step_key] ?? step.step_key
  const regCite = ONBOARDING_STEP_KEY_REG_CITES[step.step_key] ?? ''

  const isTerminal = ['passed', 'failed', 'waived', 'not_applicable'].includes(step.status)

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
        step.status === 'failed'
          ? 'border-red-200 bg-red-50/40'
          : step.status === 'passed' || step.status === 'waived' || step.status === 'not_applicable'
          ? 'border-green-100 bg-green-50/20'
          : 'border-border bg-surface hover:bg-muted/20'
      )}
    >
      {/* Step circle */}
      <div className="mt-0.5">
        <StepCircle status={step.status} />
      </div>

      {/* Step info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {!step.required && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Optional
            </span>
          )}
        </div>
        {regCite && (
          <p className="text-xs text-muted-foreground font-mono">{regCite}</p>
        )}
        {step.notes && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{step.notes}</p>
        )}
        {step.completed_at && (
          <p className="mt-1 text-xs text-muted-foreground">
            Completed{' '}
            {new Date(step.completed_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge type="onboarding_step" status={step.status} />

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              disabled={busy}
              aria-label="Step actions"
            >
              <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {!isTerminal && (
              <>
                <DropdownMenuItem onClick={() => transition('in_progress')}>
                  Mark In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => transition('passed')}>
                  Mark Passed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => transition('failed')}
                  className="text-red-600 focus:text-red-600"
                >
                  Mark Failed
                </DropdownMenuItem>
                {step.waivable && (
                  <DropdownMenuItem onClick={handleWaive} className="text-purple-600 focus:text-purple-600">
                    Waive Step
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onOpen(step)}>
              <HugeiconsIcon icon={DocumentAttachmentIcon} size={13} className="mr-2" />
              View / Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpen(step)}>
              <HugeiconsIcon icon={UserCheck01Icon} size={13} className="mr-2" />
              Reassign
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function PipelineChecklist({ pipeline, applicationId }: Props) {
  const [activeStep, setActiveStep] = useState<DriverOnboardingStep | null>(null)

  const sortedSteps = [...(pipeline.steps ?? [])].sort((a, b) => a.step_order - b.step_order)

  const passed = sortedSteps.filter((s) =>
    ['passed', 'waived', 'not_applicable'].includes(s.status)
  ).length

  return (
    <>
      {/* Progress header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {passed} / {sortedSteps.length} steps cleared
        </p>
        <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${sortedSteps.length ? (passed / sortedSteps.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {sortedSteps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            applicationId={applicationId}
            onOpen={setActiveStep}
          />
        ))}
      </div>

      {/* Step detail drawer */}
      <StepDetailDrawer
        open={!!activeStep}
        onOpenChange={(open) => { if (!open) setActiveStep(null) }}
        step={activeStep}
        applicationId={applicationId}
      />
    </>
  )
}
