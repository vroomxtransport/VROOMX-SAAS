import { z } from 'zod'

export const complianceDocSchema = z.object({
  documentType: z.enum(['dqf', 'vehicle_qualification', 'company_document']),
  entityType: z.enum(['driver', 'truck', 'company']),
  entityId: z.string().max(36).optional().or(z.literal('')),
  name: z.string().min(1, 'Document name is required').max(200),
  expiresAt: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  fileName: z.string().max(500).optional().or(z.literal('')),
  storagePath: z.string().max(500).optional().or(z.literal('')),
  fileSize: z.coerce.number().max(100_000_000).optional(),
})

export type ComplianceDocFormValues = z.infer<typeof complianceDocSchema>
