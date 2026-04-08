/**
 * Zod validation schemas for admin-side driver onboarding pipeline actions.
 *
 * These schemas are used by the authed server actions in
 * src/app/actions/driver-onboarding.ts.
 */

import { z } from 'zod'

const optionalString = z.string().optional().or(z.literal(''))

// ---------------------------------------------------------------------------
// Shared enums (mirrors DB enums)
// ---------------------------------------------------------------------------

export const onboardingStepStatusSchema = z.enum([
  'pending',
  'in_progress',
  'passed',
  'failed',
  'waived',
  'not_applicable',
])

export const onboardingStepKeySchema = z.enum([
  'application_review',
  'mvr_pull',
  'prior_employer_verification',
  'clearinghouse_query',
  'drug_test',
  'medical_verification',
  'road_test',
  'psp_query',
  'dq_file_assembly',
  'final_approval',
])

// ---------------------------------------------------------------------------
// Admin action schemas
// ---------------------------------------------------------------------------

export const updateStepStatusSchema = z.object({
  stepId: z.string().uuid('Step ID must be a valid UUID'),
  status: onboardingStepStatusSchema,
  notes: optionalString,
})

export const uploadStepResultSchema = z.object({
  stepId: z.string().uuid('Step ID must be a valid UUID'),
  fileName: z.string().min(1, 'File name is required'),
  storagePath: z.string().min(1, 'Storage path is required'),
  fileSize: z.coerce.number().int().positive().optional(),
  mimeType: optionalString,
  subCategory: z.string().min(1, 'Sub-category is required'),
  expiresAt: optionalString.nullable().optional(),
})

export const waiveStepSchema = z.object({
  stepId: z.string().uuid('Step ID must be a valid UUID'),
  reason: z.string().min(5, 'Waiver reason must be at least 5 characters'),
})

export const sendPreAdverseActionSchema = z.object({
  applicationId: z.string().uuid('Application ID must be a valid UUID'),
  failedStepIds: z
    .array(z.string().uuid())
    .min(1, 'At least one failed step must be specified'),
  findingsSummary: z
    .string()
    .min(10, 'Findings summary must be at least 10 characters')
    .max(4000, 'Findings summary must be 4000 characters or fewer'),
})

export const finalizeRejectionSchema = z.object({
  applicationId: z.string().uuid('Application ID must be a valid UUID'),
  finalReason: z
    .string()
    .min(10, 'A rejection reason is required for FCRA compliance (min 10 characters)')
    .max(4000, 'Final reason must be 4000 characters or fewer'),
})

export const assignStepSchema = z.object({
  stepId: z.string().uuid('Step ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
})

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type UpdateStepStatusInput = z.infer<typeof updateStepStatusSchema>
export type UploadStepResultInput = z.infer<typeof uploadStepResultSchema>
export type WaiveStepInput = z.infer<typeof waiveStepSchema>
export type SendPreAdverseActionInput = z.infer<typeof sendPreAdverseActionSchema>
export type FinalizeRejectionInput = z.infer<typeof finalizeRejectionSchema>
export type AssignStepInput = z.infer<typeof assignStepSchema>
