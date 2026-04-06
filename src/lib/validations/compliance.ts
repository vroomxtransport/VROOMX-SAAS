import { z } from 'zod'

export const complianceDocSchema = z.object({
  documentType: z.enum(['dqf', 'vehicle_qualification', 'company_document']),
  entityType: z.enum(['driver', 'truck', 'company']),
  entityId: z.string().max(36).optional().or(z.literal('')),
  name: z.string().min(1, 'Document name is required').max(200),
  expiresAt: z.string().max(200).optional().or(z.literal('')),
  issueDate: z.string().optional().or(z.literal('')).nullable(),
  notes: z.string().max(5000).optional().or(z.literal('')),
  fileName: z.string().max(500).optional().or(z.literal('')),
  storagePath: z.string().max(500).optional().or(z.literal('')),
  fileSize: z.coerce.number().max(100_000_000).optional(),
  subCategory: z.string().max(50).optional().or(z.literal('')),
  regulationReference: z.string().max(200).optional().or(z.literal('')),
  isRequired: z.boolean().optional(),
  status: z.enum(['valid', 'expiring_soon', 'expired']).optional(),
})

export type ComplianceDocFormValues = z.infer<typeof complianceDocSchema>
