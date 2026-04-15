'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useApplicationDetail } from '@/hooks/use-application-detail'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Home01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { approvePipeline } from '@/app/actions/driver-onboarding'
import { PipelineChecklist } from './pipeline-checklist'
import { AdverseActionModal } from './adverse-action-modal'
import { DqFileExportButton } from './dq-file-export-button'
import { ApplicationTab } from './application-tab'
import { DocumentsTab } from './documents-tab'
import { ActivityTab } from './activity-tab'

interface Props {
  applicationId: string
}

// A step is "clearable" if it is not required OR its status is in the terminal-pass set
const TERMINAL_PASS = new Set(['passed', 'waived', 'not_applicable'])

export function ApplicationDetail({ applicationId }: Props) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useApplicationDetail(applicationId)
  const [adverseModalOpen, setAdverseModalOpen] = useState(false)
  const [approving, setApproving] = useState(false)

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (error || !data) {
    return (
      <div className="rounded-md p-4 text-sm text-red-700">
        {error instanceof Error ? error.message : 'Failed to load application'}
      </div>
    )
  }

  const { application, pipeline } = data

  const fullName =
    [application.first_name, application.last_name].filter(Boolean).join(' ') ||
    'Unknown Applicant'

  // Compute whether all required steps are cleared
  const steps = pipeline?.steps ?? []
  const requiredSteps = steps.filter((s) => s.required)
  const allRequiredCleared = requiredSteps.every((s) => TERMINAL_PASS.has(s.status))
  const canApprove =
    allRequiredCleared &&
    application.status === 'in_review' &&
    !!pipeline

  const blockedReason = !pipeline
    ? 'Pipeline has not been started'
    : !allRequiredCleared
    ? 'All required pipeline steps must pass or be waived before approval'
    : undefined

  async function handleApprove() {
    if (!pipeline) return
    setApproving(true)
    try {
      const result = await approvePipeline(pipeline.id)
      if ('error' in result) {
        toast.error('Approval failed', { description: result.error })
      } else {
        queryClient.invalidateQueries({ queryKey: ['applications', applicationId] })
        toast.success('Driver approved', { description: `${fullName} has been cleared to drive.` })
      }
    } finally {
      setApproving(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <HugeiconsIcon icon={Home01Icon} size={13} />
            Home
          </Link>
          <HugeiconsIcon icon={ArrowRight01Icon} size={11} className="text-muted-foreground/40" />
          <Link href="/onboarding" className="hover:text-foreground transition-colors">
            Onboarding
          </Link>
          <HugeiconsIcon icon={ArrowRight01Icon} size={11} className="text-muted-foreground/40" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{fullName}</span>
        </nav>

        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
              {fullName}
            </h1>
            <StatusBadge type="application" status={application.status} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DqFileExportButton applicationId={applicationId} />

            {/* Reject button — only show when reviewable */}
            {(application.status === 'in_review' || application.status === 'pending_adverse_action') && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-red-600 border-red-200 hover:border-red-300"
                onClick={() => setAdverseModalOpen(true)}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} className="mr-1.5" />
                Reject
              </Button>
            )}

            {/* Approve button */}
            {application.status === 'in_review' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!canApprove || approving}
                      onClick={handleApprove}
                    >
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="mr-1.5" />
                      {approving ? 'Approving...' : 'Approve'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {blockedReason && (
                  <TooltipContent side="bottom" className="max-w-[240px] text-center text-xs">
                    {blockedReason}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="application">
          <TabsList className="border-b border-border bg-transparent p-0 h-auto rounded-none gap-0">
            {['application', 'pipeline', 'documents', 'activity'].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium capitalize text-muted-foreground data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-foreground transition-colors"
              >
                {tab === 'pipeline' ? 'Pipeline' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="application" className="mt-5">
            <ApplicationTab application={application} consents={data.consents} addressHistory={data.addressHistory} />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-5">
            {pipeline ? (
              <PipelineChecklist pipeline={pipeline} applicationId={applicationId} />
            ) : (
              <PipelineNotStarted applicationId={applicationId} appStatus={application.status} />
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-5">
            <DocumentsTab applicationId={applicationId} documents={data.documents} />
          </TabsContent>

          <TabsContent value="activity" className="mt-5">
            <ActivityTab applicationId={applicationId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Adverse action modal */}
      <AdverseActionModal
        open={adverseModalOpen}
        onOpenChange={setAdverseModalOpen}
        applicationId={applicationId}
        application={application}
        steps={steps}
      />
    </TooltipProvider>
  )
}

function PipelineNotStarted({ applicationId, appStatus }: { applicationId: string; appStatus: string }) {
  const [starting, setStarting] = useState(false)
  const { refetch } = useApplicationDetail(applicationId)

  async function handleStart() {
    setStarting(true)
    try {
      const { startPipeline } = await import('@/app/actions/driver-onboarding')
      const result = await startPipeline(applicationId)
      if ('error' in result) {
        toast.error('Failed to start pipeline', { description: result.error })
      } else {
        toast.success('Pipeline started', { description: '10 compliance steps have been created.' })
        await refetch()
      }
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 text-center">
      <p className="text-sm font-medium text-foreground mb-1">Pipeline not started</p>
      <p className="text-xs text-muted-foreground max-w-[300px] mb-4">
        {appStatus === 'submitted'
          ? 'Start the compliance pipeline to begin processing this application.'
          : 'The pipeline can only be started once the application is submitted.'}
      </p>
      {appStatus === 'submitted' && (
        <Button size="sm" onClick={handleStart} disabled={starting}>
          {starting ? 'Starting...' : 'Start Pipeline'}
        </Button>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-4 w-48 rounded bg-muted/40" />
      <div className="flex items-center gap-3">
        <div className="h-7 w-48 rounded bg-muted/40" />
        <div className="h-5 w-20 rounded bg-muted/40" />
      </div>
      <div className="h-10 w-full rounded bg-muted/40" />
      <div className="h-96 w-full rounded-xl bg-muted/40" />
    </div>
  )
}
