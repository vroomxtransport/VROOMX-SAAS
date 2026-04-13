'use server'

/**
 * Server actions for the admin-facing driver onboarding pipeline.
 *
 * All actions are authenticated and require specific permissions.
 * Every action follows: Zod → authorize() → tenant_id filter →
 * Supabase query → safeError() → audit log → revalidatePath()
 *
 * Step configuration (10 steps seeded per pipeline):
 *   1. application_review   required=true,  waivable=false
 *   2. mvr_pull             required=true,  waivable=false
 *   3. prior_employer_verification required=true, waivable=false
 *   4. clearinghouse_query  required=true,  waivable=false
 *   5. drug_test            required=true,  waivable=false
 *   6. medical_verification required=true,  waivable=false
 *   7. road_test            required=true,  waivable=true  (§ 391.33 CDL substitution)
 *   8. psp_query            required=false, waivable=true  (tenant opt-out)
 *   9. dq_file_assembly     required=true,  waivable=false
 *  10. final_approval       required=true,  waivable=false
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { authorize, safeError } from '@/lib/authz'
import { logAuditEvent } from '@/lib/audit-log'
import { redactPii } from '@/lib/audit-redact'
import { countBusinessDays } from '@/lib/business-days'
import { copyFile } from '@/lib/storage'
import {
  updateStepStatusSchema,
  uploadStepResultSchema,
  waiveStepSchema,
  sendPreAdverseActionSchema,
  finalizeRejectionSchema,
  assignStepSchema,
} from '@/lib/validations/driver-onboarding'
import type { DriverOnboardingPipeline, DriverOnboardingStep } from '@/types/database'
import { captureAsyncError } from '@/lib/async-safe'
import { getResend } from '@/lib/resend/client'
import { PreAdverseActionEmail } from '@/components/email/pre-adverse-action-email'
import { AdverseActionFinalEmail } from '@/components/email/adverse-action-final-email'

// ---------------------------------------------------------------------------
// Step seed configuration
// ---------------------------------------------------------------------------

interface StepSeed {
  step_key: string
  step_order: number
  required: boolean
  waivable: boolean
}

const STEP_SEEDS: StepSeed[] = [
  { step_key: 'application_review',          step_order: 1,  required: true,  waivable: false },
  { step_key: 'mvr_pull',                    step_order: 2,  required: true,  waivable: false },
  { step_key: 'prior_employer_verification', step_order: 3,  required: true,  waivable: false },
  { step_key: 'clearinghouse_query',         step_order: 4,  required: true,  waivable: false },
  { step_key: 'drug_test',                   step_order: 5,  required: true,  waivable: false },
  { step_key: 'medical_verification',        step_order: 6,  required: true,  waivable: false },
  { step_key: 'road_test',                   step_order: 7,  required: true,  waivable: true  }, // § 391.33 CDL substitution
  { step_key: 'psp_query',                   step_order: 8,  required: false, waivable: true  }, // tenant opt-out
  { step_key: 'dq_file_assembly',            step_order: 9,  required: true,  waivable: false },
  { step_key: 'final_approval',              step_order: 10, required: true,  waivable: false },
]

// Terminal-pass statuses for pipeline clearance check
const TERMINAL_PASS_STATUSES = new Set(['passed', 'waived', 'not_applicable'])

// D1: Step status state machine — prevents invalid transitions (e.g. passed→pending).
// Waived/not_applicable transitions from pending are handled separately by waiveStep().
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  pending:        new Set(['in_progress', 'passed', 'failed']),
  in_progress:    new Set(['passed', 'failed']),
  // Terminal states — no outgoing transitions
  passed:         new Set<string>(),
  failed:         new Set<string>(),
  waived:         new Set<string>(),
  not_applicable: new Set<string>(),
}

// ---------------------------------------------------------------------------
// startPipeline
// ---------------------------------------------------------------------------

/**
 * Create a pipeline and seed 10 step rows for a submitted application.
 * Sets application status to 'in_review'.
 * Only callable when application.status === 'submitted'.
 */
export async function startPipeline(applicationId: string): Promise<
  | { pipeline: DriverOnboardingPipeline & { steps: DriverOnboardingStep[] } }
  | { error: string }
> {
  const idParsed = z.string().uuid().safeParse(applicationId)
  if (!idParsed.success) return { error: 'Invalid application ID' }

  const auth = await authorize('driver_onboarding.create', { rateLimit: { key: 'startPipeline', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Verify application exists, belongs to tenant, and is in 'submitted' state
  const { data: application, error: appFetchError } = await supabase
    .from('driver_applications')
    .select('id, status, tenant_id, first_name, last_name')
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)
    .single()

  if (appFetchError || !application) {
    return { error: safeError(appFetchError ?? { message: 'Not found' }, 'startPipeline') }
  }

  if (application.status !== 'submitted') {
    return { error: 'Pipeline can only be started for submitted applications.' }
  }

  // Check if pipeline already exists (idempotency guard)
  const { data: existingPipeline } = await supabase
    .from('driver_onboarding_pipelines')
    .select('id')
    .eq('application_id', idParsed.data)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existingPipeline) {
    return { error: 'Pipeline already exists for this application.' }
  }

  // Insert pipeline row
  const { data: pipeline, error: pipelineError } = await supabase
    .from('driver_onboarding_pipelines')
    .insert({
      tenant_id: tenantId,
      application_id: idParsed.data,
      overall_status: 'pending',
    })
    .select('*')
    .single()

  if (pipelineError || !pipeline) {
    return { error: safeError(pipelineError ?? { message: 'Insert failed' }, 'startPipeline') }
  }

  // Seed 10 step rows
  const stepRows = STEP_SEEDS.map((seed) => ({
    tenant_id: tenantId,
    pipeline_id: pipeline.id as string,
    step_key: seed.step_key,
    step_order: seed.step_order,
    required: seed.required,
    waivable: seed.waivable,
    status: 'pending',
  }))

  const { data: steps, error: stepsError } = await supabase
    .from('driver_onboarding_steps')
    .insert(stepRows)
    .select('*')

  if (stepsError) {
    // D4: Rollback pipeline — log failure if rollback itself fails
    const { error: rollbackError } = await supabase
      .from('driver_onboarding_pipelines')
      .delete()
      .eq('id', pipeline.id as string)
      .eq('tenant_id', tenantId)
    if (rollbackError) {
      console.error('[startPipeline] Rollback failed — orphan pipeline:', {
        pipelineId: pipeline.id,
        tenantId,
        rollbackError: rollbackError.message,
      })
    }
    return { error: safeError(stepsError, 'startPipeline:steps') }
  }

  // Update application status to in_review
  const { error: appUpdateError } = await supabase
    .from('driver_applications')
    .update({
      status: 'in_review',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)

  if (appUpdateError) {
    return { error: safeError(appUpdateError, 'startPipeline:appUpdate') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: idParsed.data,
    action: 'pipeline.started',
    description: `Onboarding pipeline started for ${application.first_name ?? ''} ${application.last_name ?? ''}`.trim(),
    actorId: user.id,
    actorEmail: user.email,
    metadata: { pipeline_id: pipeline.id },
  }).catch(captureAsyncError('onboarding action'))

  revalidatePath('/onboarding')
  revalidatePath(`/onboarding/${idParsed.data}`)

  return {
    pipeline: {
      ...(pipeline as DriverOnboardingPipeline),
      steps: (steps ?? []) as DriverOnboardingStep[],
    },
  }
}

// ---------------------------------------------------------------------------
// updateStepStatus
// ---------------------------------------------------------------------------

/**
 * Transition a step to a new status.
 * Sets started_at on first transition to in_progress.
 * Sets completed_at on any terminal status (passed/failed/waived/not_applicable).
 * Auto-bumps pipeline overall_status to in_progress on first non-pending step.
 */
export async function updateStepStatus(
  stepId: string,
  status: string,
  notes?: string
): Promise<{ step: DriverOnboardingStep } | { error: string }> {
  const parsed = updateStepStatusSchema.safeParse({ stepId, status, notes })
  if (!parsed.success) return { error: 'Validation failed' }

  const auth = await authorize('driver_onboarding.update', { rateLimit: { key: 'updateOnboardingStep', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Fetch the step — must belong to this tenant
  const { data: step, error: fetchError } = await supabase
    .from('driver_onboarding_steps')
    .select('*, pipeline_id')
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !step) {
    return { error: safeError(fetchError ?? { message: 'Not found' }, 'updateStepStatus') }
  }

  // D1: Validate state transition — reject invalid moves (e.g. passed→pending)
  const currentStatus = step.status as string
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus]
  if (!allowedNext || !allowedNext.has(parsed.data.status)) {
    return {
      error: `Invalid status transition: cannot move from "${currentStatus}" to "${parsed.data.status}".`,
    }
  }

  const now = new Date().toISOString()
  const isTerminal = TERMINAL_PASS_STATUSES.has(parsed.data.status) || parsed.data.status === 'failed'

  const stepUpdate: Record<string, unknown> = {
    status: parsed.data.status,
    notes: parsed.data.notes ?? (step.notes as string | null),
    updated_at: now,
  }

  if (parsed.data.status === 'in_progress' && !step.started_at) {
    stepUpdate.started_at = now
  }

  if (isTerminal) {
    stepUpdate.completed_at = now
  }

  const { data: updatedStep, error: updateError } = await supabase
    .from('driver_onboarding_steps')
    .update(stepUpdate)
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (updateError || !updatedStep) {
    return { error: safeError(updateError ?? { message: 'Update failed' }, 'updateStepStatus') }
  }

  // Auto-bump pipeline to in_progress on first non-pending step
  if (parsed.data.status !== 'pending') {
    const { data: pipeline } = await supabase
      .from('driver_onboarding_pipelines')
      .select('id, overall_status')
      .eq('id', step.pipeline_id as string)
      .eq('tenant_id', tenantId)
      .single()

    if (pipeline && pipeline.overall_status === 'pending') {
      await supabase
        .from('driver_onboarding_pipelines')
        .update({ overall_status: 'in_progress' })
        .eq('id', step.pipeline_id as string)
        .eq('tenant_id', tenantId)
    }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_onboarding_step',
    entityId: parsed.data.stepId,
    action: `step.status_changed`,
    description: `Step ${step.step_key} transitioned to ${parsed.data.status}`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({
      step_key: step.step_key,
      old_status: step.status,
      new_status: parsed.data.status,
      notes: parsed.data.notes,
    }) as Record<string, unknown>,
  }).catch(captureAsyncError('onboarding action'))

  // Determine applicationId for path revalidation
  const { data: pipelineForPath } = await supabase
    .from('driver_onboarding_pipelines')
    .select('application_id')
    .eq('id', step.pipeline_id as string)
    .eq('tenant_id', tenantId)
    .single()

  if (pipelineForPath?.application_id) {
    revalidatePath(`/onboarding/${pipelineForPath.application_id}`)
  }

  return { step: updatedStep as DriverOnboardingStep }
}

// ---------------------------------------------------------------------------
// uploadStepResult
// ---------------------------------------------------------------------------

/**
 * Persist a compliance document linked to a specific onboarding step.
 * File upload happens client-side; this action records the metadata row.
 * Inserts into compliance_documents with entity_type='driver_application'.
 */
export async function uploadStepResult(
  stepId: string,
  fileMeta: unknown,
  subCategory: string,
  expiresAt?: string
): Promise<{ documentId: string } | { error: string }> {
  const parsed = uploadStepResultSchema.safeParse({
    stepId,
    ...(fileMeta as object),
    subCategory,
    expiresAt,
  })
  if (!parsed.success) return { error: 'Validation failed' }

  const auth = await authorize('driver_onboarding.update', { rateLimit: { key: 'uploadStepResult', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Verify step belongs to this tenant and fetch pipeline→application
  const { data: step, error: stepFetchError } = await supabase
    .from('driver_onboarding_steps')
    .select('id, pipeline_id, step_key, tenant_id')
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .single()

  if (stepFetchError || !step) {
    return { error: safeError(stepFetchError ?? { message: 'Not found' }, 'uploadStepResult') }
  }

  // Fetch application_id from pipeline
  const { data: pipeline, error: pipelineFetchError } = await supabase
    .from('driver_onboarding_pipelines')
    .select('application_id')
    .eq('id', step.pipeline_id as string)
    .eq('tenant_id', tenantId)
    .single()

  if (pipelineFetchError || !pipeline) {
    return { error: safeError(pipelineFetchError ?? { message: 'Pipeline not found' }, 'uploadStepResult') }
  }

  const { data: doc, error: insertError } = await supabase
    .from('compliance_documents')
    .insert({
      tenant_id: tenantId,
      entity_type: 'driver_application',
      entity_id: pipeline.application_id as string,
      document_type: 'dqf',
      name: parsed.data.fileName,
      file_name: parsed.data.fileName,
      storage_path: parsed.data.storagePath,
      file_size: parsed.data.fileSize ?? null,
      sub_category: parsed.data.subCategory,
      expires_at: parsed.data.expiresAt ?? null,
      onboarding_step_id: parsed.data.stepId,
      uploaded_by: user.id,
      status: 'valid',
    })
    .select('id')
    .single()

  if (insertError || !doc) {
    return { error: safeError(insertError ?? { message: 'Insert failed' }, 'uploadStepResult') }
  }

  revalidatePath(`/onboarding/${pipeline.application_id}`)
  return { documentId: doc.id as string }
}

// ---------------------------------------------------------------------------
// waiveStep
// ---------------------------------------------------------------------------

/**
 * Waive a step (e.g. road_test via § 391.33 CDL substitution).
 * Only allowed if step.waivable = true.
 */
export async function waiveStep(
  stepId: string,
  reason: string
): Promise<{ step: DriverOnboardingStep } | { error: string }> {
  const parsed = waiveStepSchema.safeParse({ stepId, reason })
  if (!parsed.success) return { error: 'Validation failed' }

  const auth = await authorize('driver_onboarding.update', { rateLimit: { key: 'waiveStep', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: step, error: fetchError } = await supabase
    .from('driver_onboarding_steps')
    .select('id, waivable, status, step_key, pipeline_id')
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !step) {
    return { error: safeError(fetchError ?? { message: 'Not found' }, 'waiveStep') }
  }

  if (!step.waivable) {
    return { error: 'This step cannot be waived.' }
  }

  // DRV-002: Prevent waiving already-terminal steps (state machine integrity)
  const terminalStatuses = new Set(['passed', 'failed', 'waived', 'not_applicable'])
  if (terminalStatuses.has(step.status as string)) {
    return { error: `Cannot waive a step that is already "${step.status}".` }
  }

  const now = new Date().toISOString()

  const { data: updatedStep, error: updateError } = await supabase
    .from('driver_onboarding_steps')
    .update({
      status: 'waived',
      waive_reason: parsed.data.reason,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (updateError || !updatedStep) {
    return { error: safeError(updateError ?? { message: 'Update failed' }, 'waiveStep') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_onboarding_step',
    entityId: parsed.data.stepId,
    action: 'step.waived',
    description: `Step ${step.step_key} waived`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({ step_key: step.step_key, reason: parsed.data.reason }) as Record<string, unknown>,
  }).catch(captureAsyncError('onboarding action'))

  // Fetch application_id for path revalidation
  const { data: pipeline } = await supabase
    .from('driver_onboarding_pipelines')
    .select('application_id')
    .eq('id', step.pipeline_id as string)
    .eq('tenant_id', tenantId)
    .single()

  if (pipeline?.application_id) {
    revalidatePath(`/onboarding/${pipeline.application_id}`)
  }

  return { step: updatedStep as DriverOnboardingStep }
}

// ---------------------------------------------------------------------------
// assignStep
// ---------------------------------------------------------------------------

/**
 * Assign a step to a specific user.
 * Validates that the target userId is a member of the same tenant.
 */
export async function assignStep(
  stepId: string,
  userId: string
): Promise<{ step: DriverOnboardingStep } | { error: string }> {
  const parsed = assignStepSchema.safeParse({ stepId, userId })
  if (!parsed.success) return { error: 'Validation failed' }

  const auth = await authorize('driver_onboarding.update', { rateLimit: { key: 'assignStep', limit: 20, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Verify target userId is a tenant member
  const { data: membership, error: memberError } = await supabase
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', parsed.data.userId)
    .maybeSingle()

  if (memberError || !membership) {
    return { error: 'Assignee is not a member of this organization.' }
  }

  // Verify step belongs to this tenant
  const { data: step, error: stepFetchError } = await supabase
    .from('driver_onboarding_steps')
    .select('id, step_key, pipeline_id')
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .single()

  if (stepFetchError || !step) {
    return { error: safeError(stepFetchError ?? { message: 'Not found' }, 'assignStep') }
  }

  const { data: updatedStep, error: updateError } = await supabase
    .from('driver_onboarding_steps')
    .update({
      assignee_id: parsed.data.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.stepId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (updateError || !updatedStep) {
    return { error: safeError(updateError ?? { message: 'Update failed' }, 'assignStep') }
  }

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_onboarding_step',
    entityId: parsed.data.stepId,
    action: 'step.assigned',
    description: `Step ${step.step_key} assigned`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { step_key: step.step_key, assignee_id: parsed.data.userId },
  }).catch(captureAsyncError('onboarding action'))

  const { data: pipeline } = await supabase
    .from('driver_onboarding_pipelines')
    .select('application_id')
    .eq('id', step.pipeline_id as string)
    .eq('tenant_id', tenantId)
    .single()

  if (pipeline?.application_id) {
    revalidatePath(`/onboarding/${pipeline.application_id}`)
  }

  return { step: updatedStep as DriverOnboardingStep }
}

// ---------------------------------------------------------------------------
// sendPreAdverseAction
// ---------------------------------------------------------------------------

/**
 * Initiate the FCRA two-step adverse-action workflow.
 * Sets application status to 'pending_adverse_action', stamps pre_adverse_sent_at.
 * Validates that the application is in_review and at least one cited step has failed.
 */
export async function sendPreAdverseAction(
  applicationId: string,
  failedStepIds: string[],
  findingsSummary: string
): Promise<{ success: true } | { error: string }> {
  const parsed = sendPreAdverseActionSchema.safeParse({ applicationId, failedStepIds, findingsSummary })
  if (!parsed.success) return { error: 'Validation failed' }

  const auth = await authorize('driver_onboarding.adverse_action', {
    rateLimit: { key: 'sendPreAdverseAction', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Fetch application — tenant-scoped (include email for FCRA notice)
  const { data: application, error: appFetchError } = await supabase
    .from('driver_applications')
    .select('id, status, tenant_id, first_name, last_name, email')
    .eq('id', parsed.data.applicationId)
    .eq('tenant_id', tenantId)
    .single<{ id: string; status: string; tenant_id: string; first_name: string | null; last_name: string | null; email: string | null }>()

  if (appFetchError || !application) {
    return { error: safeError(appFetchError ?? { message: 'Not found' }, 'sendPreAdverseAction') }
  }

  if (application.status !== 'in_review') {
    return { error: 'Pre-adverse action can only be sent for applications under review.' }
  }

  // Validate that every cited step belongs to this tenant and has status='failed'
  const { data: steps, error: stepsError } = await supabase
    .from('driver_onboarding_steps')
    .select('id, status, tenant_id')
    .in('id', parsed.data.failedStepIds)
    .eq('tenant_id', tenantId)

  if (stepsError || !steps || steps.length !== parsed.data.failedStepIds.length) {
    return { error: 'One or more specified steps were not found or belong to another tenant.' }
  }

  const nonFailed = steps.filter((s) => s.status !== 'failed')
  if (nonFailed.length > 0) {
    return { error: 'All cited steps must have status "failed".' }
  }

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      status: 'pending_adverse_action',
      pre_adverse_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.applicationId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'sendPreAdverseAction') }
  }

  // C1: Send FCRA pre-adverse action notice via Resend.
  // DRV-005: application.email is already fetched above — no fallback needed.
  if (application.email && process.env.RESEND_API_KEY) {
    // Fetch tenant name for the email
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    // DRV-001: tenants table has no email column — fetch admin contact from memberships
    const { data: adminMember } = await supabase
      .from('tenant_memberships')
      .select('email')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    // Compute dispute deadline (5 business days from now) using UTC for consistency
    // with countBusinessDays() used in finalizeRejection.
    const disputeDate = new Date()
    let bizDaysAdded = 0
    while (bizDaysAdded < 5) {
      disputeDate.setUTCDate(disputeDate.getUTCDate() + 1)
      const day = disputeDate.getUTCDay()
      if (day !== 0 && day !== 6) bizDaysAdded++
    }
    const disputeDeadline = disputeDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })

    void getResend().emails.send({
      from: 'VroomX <noreply@vroomx.com>',
      to: application.email as string,
      subject: `Pre-Adverse Action Notice — ${tenantData?.name ?? 'Your Carrier'}`,
      react: PreAdverseActionEmail({
        tenantName: (tenantData?.name as string) ?? 'Your Carrier',
        applicantFirstName: (application.first_name as string) ?? 'Applicant',
        findingsSummary: parsed.data.findingsSummary,
        disputeDeadline,
        tenantContactEmail: (adminMember?.email as string) ?? undefined,
      }),
    }).catch(captureAsyncError('pre-adverse-action email'))
  }

  // DRV-004: wrap audit metadata with redactPii()
  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: parsed.data.applicationId,
    action: 'application.pre_adverse_sent',
    description: `Pre-adverse action notice sent`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({
      failed_step_ids: parsed.data.failedStepIds,
      findings_summary: parsed.data.findingsSummary,
    }) as Record<string, unknown>,
  }).catch(captureAsyncError('onboarding action'))

  revalidatePath('/onboarding')
  revalidatePath(`/onboarding/${parsed.data.applicationId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// finalizeRejection
// ---------------------------------------------------------------------------

/**
 * Send the final FCRA adverse-action notice and mark the application rejected.
 *
 * Guards:
 * - pre_adverse_sent_at must not be null (pre-adverse must have been sent first)
 * - At least 5 calendar days must have passed since pre_adverse_sent_at
 * - Application must be in 'pending_adverse_action' state
 */
export async function finalizeRejection(
  applicationId: string,
  finalReason: string
): Promise<{ success: true } | { error: string }> {
  const parsed = finalizeRejectionSchema.safeParse({ applicationId, finalReason })
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return { error: firstError ?? 'Validation failed' }
  }

  const auth = await authorize('driver_onboarding.adverse_action', {
    rateLimit: { key: 'finalizeRejection', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  const { data: application, error: fetchError } = await supabase
    .from('driver_applications')
    .select('id, status, pre_adverse_sent_at, tenant_id, first_name, last_name, email')
    .eq('id', parsed.data.applicationId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !application) {
    return { error: safeError(fetchError ?? { message: 'Not found' }, 'finalizeRejection') }
  }

  if (application.status !== 'pending_adverse_action') {
    return { error: 'Rejection can only be finalized after pre-adverse action notice is sent.' }
  }

  if (!application.pre_adverse_sent_at) {
    return { error: 'Pre-adverse action notice has not been sent.' }
  }

  const sentAt = new Date(application.pre_adverse_sent_at as string)
  const businessDaysSinceSent = countBusinessDays(sentAt, new Date())

  if (businessDaysSinceSent < 5) {
    const remaining = 5 - businessDaysSinceSent
    return {
      error: `The 5-business-day dispute window has not passed. ${remaining} business day(s) remaining.`,
    }
  }

  const now = new Date().toISOString()

  const { error: appUpdateError } = await supabase
    .from('driver_applications')
    .update({
      status: 'rejected',
      adverse_action_sent_at: now,
      rejection_reason: parsed.data.finalReason,
      updated_at: now,
    })
    .eq('id', parsed.data.applicationId)
    .eq('tenant_id', tenantId)

  if (appUpdateError) {
    return { error: safeError(appUpdateError, 'finalizeRejection') }
  }

  // Update pipeline overall_status to 'rejected'
  await supabase
    .from('driver_onboarding_pipelines')
    .update({ overall_status: 'rejected', rejected_at: now, rejected_by: user.id })
    .eq('application_id', parsed.data.applicationId)
    .eq('tenant_id', tenantId)

  // C2: Send FCRA final adverse-action notice via Resend.
  if (application.email && process.env.RESEND_API_KEY) {
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    // DRV-001: fetch admin contact from memberships (tenants has no email column)
    const { data: adminMember } = await supabase
      .from('tenant_memberships')
      .select('email')
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    void getResend().emails.send({
      from: 'VroomX <noreply@vroomx.com>',
      to: application.email as string,
      subject: `Adverse Action Notice — ${tenantData?.name ?? 'Your Carrier'}`,
      react: AdverseActionFinalEmail({
        tenantName: (tenantData?.name as string) ?? 'Your Carrier',
        applicantFirstName: (application.first_name as string) ?? 'Applicant',
        finalReason: parsed.data.finalReason,
        tenantContactEmail: (adminMember?.email as string) ?? undefined,
      }),
    }).catch(captureAsyncError('adverse-action-final email'))
  }

  // DRV-004: wrap audit metadata with redactPii()
  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: parsed.data.applicationId,
    action: 'application.rejected',
    description: `Application rejected (adverse action finalized)`,
    actorId: user.id,
    actorEmail: user.email,
    metadata: redactPii({
      adverse_action_sent_at: now,
      final_reason: parsed.data.finalReason,
    }) as Record<string, unknown>,
  }).catch(captureAsyncError('onboarding action'))

  revalidatePath('/onboarding')
  revalidatePath(`/onboarding/${parsed.data.applicationId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// Applicant → driver document transfer (helper for approvePipeline)
// ---------------------------------------------------------------------------

/**
 * Maps applicant-uploaded document types to the driver_documents type enum.
 * Both license scans become 'cdl' rows (FMCSA Part 391 drivers are CDL holders).
 */
const APPLICANT_TO_DRIVER_DOC_TYPE: Record<string, 'cdl' | 'medical_card' | 'other'> = {
  license_front: 'cdl',
  license_back:  'cdl',
  medical_card:  'medical_card',
  other:         'other',
}

/**
 * Copy applicant-uploaded files from `driver_application_documents` into the
 * new driver's `driver_documents` table on hire. Keeps the applicant originals
 * intact for FMCSA § 391.51 audit retention (3 years).
 *
 * Partial failures are logged but do NOT throw — the driver is already created
 * by the time this runs, and a file-level hiccup shouldn't block the hire.
 * Admins can re-upload manually from the driver's Files tab.
 *
 * Returns a summary for audit_log metadata.
 */
/**
 * Extract a file extension from a storage path. Handles edge cases:
 *   - Path with no dot         → 'bin'
 *   - Path with dot in a dir   → 'bin' (dot must be in the last segment)
 *   - Path with trailing dot   → 'bin' (empty extension)
 *   - Path like '.hidden'      → 'bin' (leading-dot hidden files)
 *   - Path 'a/b/c.tar.gz'      → 'gz'
 */
function extractFileExtension(storagePath: string): string {
  const lastSegment = storagePath.split('/').pop() ?? ''
  const dotIndex = lastSegment.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
    // No dot, leading dot, or trailing dot → use fallback
    return 'bin'
  }
  return lastSegment.slice(dotIndex + 1)
}

async function transferApplicantDocumentsToDriver(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  driverId: string,
  actorUserId: string,
): Promise<{ transferred: number; failed: number; skipped: number }> {
  const { data: applicantDocs, error: fetchError } = await supabase
    .from('driver_application_documents')
    .select('id, document_type, file_name, storage_path, file_size, scan_status')
    .eq('tenant_id', tenantId)
    .eq('application_id', applicationId)

  if (fetchError || !applicantDocs || applicantDocs.length === 0) {
    return { transferred: 0, failed: 0, skipped: 0 }
  }

  // C3 fix: Transfer docs that are NOT flagged. Previously this filtered for
  // scan_status === 'clean', but since AV scanning is TODO (v2), no docs ever
  // reached 'clean' status — so zero docs transferred on hire.
  //
  // Changed to: exclude only 'flagged' docs. 'pending' docs (the default) are
  // allowed through because admins have manually reviewed the application through
  // the pipeline before approving. Flagged docs are excluded as a safety gate.
  //
  // TODO(v2): revert to scan_status === 'clean' once AV edge function ships.
  const transferableDocs = applicantDocs.filter((d) => d.scan_status !== 'flagged')
  const skippedCount = applicantDocs.length - transferableDocs.length

  if (skippedCount > 0) {
    const flaggedDocs = applicantDocs.filter((d) => d.scan_status === 'flagged')
    console.warn('[transferApplicantDocumentsToDriver] skipping flagged docs', {
      tenantId,
      applicationId,
      driverId,
      skippedCount,
      skippedIds: flaggedDocs.map((d) => d.id),
    })
  }

  // Log unscanned docs being transferred (audit trail until AV ships)
  const unscannedTransferred = transferableDocs.filter((d) => d.scan_status !== 'clean')
  if (unscannedTransferred.length > 0) {
    console.warn('[transferApplicantDocumentsToDriver] transferring unscanned docs (AV pending)', {
      tenantId,
      applicationId,
      driverId,
      count: unscannedTransferred.length,
      docIds: unscannedTransferred.map((d) => d.id),
    })
  }

  const results = await Promise.allSettled(
    transferableDocs.map(async (doc) => {
      const ext = extractFileExtension(doc.storage_path)
      const newPath = `${tenantId}/${driverId}/${crypto.randomUUID()}.${ext}`

      const { error: copyError } = await copyFile(supabase, 'documents', doc.storage_path, newPath)
      if (copyError) throw new Error(`copy failed: ${copyError}`)

      const mappedType = APPLICANT_TO_DRIVER_DOC_TYPE[doc.document_type as string] ?? 'other'

      const { error: insertError } = await supabase.from('driver_documents').insert({
        tenant_id:     tenantId,
        driver_id:     driverId,
        document_type: mappedType,
        file_name:     doc.file_name,
        storage_path:  newPath,
        file_size:     doc.file_size,
        expires_at:    null,
        // uploaded_by = admin who approved the hire, preserving accountability for
        // promoting applicant bytes into the trusted driver doc space. Original
        // applicant provenance stays on driver_application_documents (FMCSA § 391.51).
        uploaded_by:   actorUserId,
      })

      if (insertError) {
        // Storage copy succeeded but DB insert failed — roll back the copy
        // to avoid orphan files in the driver's path. Log any rollback-remove
        // failure so orphans can be audited later.
        await supabase.storage
          .from('documents')
          .remove([newPath])
          .catch((removeErr) => {
            console.error(
              '[transferApplicantDocumentsToDriver] rollback-remove failed — orphan at',
              newPath,
              removeErr,
            )
          })
        throw new Error(`insert failed: ${insertError.message}`)
      }
    })
  )

  const transferred = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.length - transferred

  if (failed > 0) {
    const reasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason))
    console.error('[transferApplicantDocumentsToDriver] partial failure', {
      tenantId,
      applicationId,
      driverId,
      transferred,
      failed,
      reasons,
    })
  }

  return { transferred, failed, skipped: skippedCount }
}

// ---------------------------------------------------------------------------
// approvePipeline
// ---------------------------------------------------------------------------

/**
 * Server-side pre-check then delegate to the approve_pipeline() Postgres RPC.
 *
 * Pre-check (TOCTOU defense — also enforced by DB trigger):
 * All required steps must be in passed / waived / not_applicable.
 *
 * On success, the RPC atomically:
 * 1. Re-checks required steps (DB-level guard)
 * 2. Inserts a new drivers row
 * 3. Sets pipeline overall_status='cleared', driver_id=<new>
 * 4. Sets application status='approved'
 * 5. Repoints compliance_documents entity_type to 'driver'
 * 6. Inserts audit_logs entry
 *
 * After the RPC succeeds, the TS action also copies applicant self-uploaded
 * files (license front/back, medical card) from driver_application_documents
 * into the driver's canonical path and inserts driver_documents rows, so the
 * driver's Files tab is populated immediately on hire.
 */
export async function approvePipeline(
  pipelineId: string
): Promise<{ driverId: string } | { error: string }> {
  const idParsed = z.string().uuid().safeParse(pipelineId)
  if (!idParsed.success) return { error: 'Invalid pipeline ID' }

  const auth = await authorize('driver_onboarding.approve', { rateLimit: { key: 'approvePipeline', limit: 10, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Fetch pipeline — tenant-scoped
  const { data: pipeline, error: pipelineFetchError } = await supabase
    .from('driver_onboarding_pipelines')
    .select('id, application_id, overall_status, tenant_id')
    .eq('id', idParsed.data)
    .eq('tenant_id', tenantId)
    .single()

  if (pipelineFetchError || !pipeline) {
    return { error: safeError(pipelineFetchError ?? { message: 'Not found' }, 'approvePipeline') }
  }

  // Fetch all steps for this pipeline
  const { data: steps, error: stepsFetchError } = await supabase
    .from('driver_onboarding_steps')
    .select('id, step_key, status, required')
    .eq('pipeline_id', idParsed.data)
    .eq('tenant_id', tenantId)

  if (stepsFetchError || !steps) {
    return { error: safeError(stepsFetchError ?? { message: 'Steps not found' }, 'approvePipeline') }
  }

  // Server-side pre-check: all required steps must be in terminal-pass state
  const blockedSteps = steps.filter(
    (s) => s.required && !TERMINAL_PASS_STATUSES.has(s.status as string)
  )

  if (blockedSteps.length > 0) {
    const stepNames = blockedSteps.map((s) => s.step_key).join(', ')
    return {
      error: `Cannot approve: required step(s) not yet completed: ${stepNames}`,
    }
  }

  // SEC-002: corrected RPC call — parameter name must match the SQL function declaration
  // approve_pipeline(p_pipeline_id UUID). The previous call used `pipeline_id` which
  // caused PostgREST to return a 404 / 500 silently. Also: the RPC declares
  // RETURNS SETOF drivers, so Supabase returns an array of drivers rows with `id`,
  // NOT an object with `driver_id`.
  const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_pipeline', {
    p_pipeline_id: idParsed.data,
  })

  if (rpcError) {
    return { error: safeError(rpcError, 'approvePipeline:rpc') }
  }

  // RPC returns SETOF drivers — extract the id from the first row
  const driverId = Array.isArray(rpcResult)
    ? (rpcResult[0]?.id as string | undefined)
    : undefined

  if (!driverId) {
    return { error: 'Pipeline approved but driver row was not returned' }
  }

  // Transfer applicant self-uploaded docs (license scans, medical card) into
  // the new driver's canonical path + driver_documents rows. Partial failures
  // are logged server-side and surfaced in audit metadata, but never block
  // the hire — the driver is already created by the RPC at this point.
  const transferSummary = await transferApplicantDocumentsToDriver(
    supabase,
    tenantId,
    pipeline.application_id as string,
    driverId,
    user.id,
  )

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'driver_application',
    entityId: pipeline.application_id as string,
    action: 'pipeline.approved',
    description: 'Pipeline approved — applicant promoted to driver',
    actorId: user.id,
    actorEmail: user.email,
    metadata: {
      pipeline_id: idParsed.data,
      driver_id: driverId,
      docs_transferred: transferSummary.transferred,
      docs_failed: transferSummary.failed,
      docs_skipped_unscanned: transferSummary.skipped,
    },
  }).catch(captureAsyncError('onboarding action'))

  revalidatePath('/onboarding')
  revalidatePath(`/onboarding/${pipeline.application_id}`)
  revalidatePath('/drivers')
  revalidatePath(`/drivers/${driverId}`)

  return { driverId }
}
