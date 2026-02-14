import { z } from 'zod'

export const complianceDocSchema = z.object({
  documentType: z.enum(['dqf', 'vehicle_qualification', 'company_document']),
  entityType: z.enum(['driver', 'truck', 'company']),
  entityId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Document name is required'),
  expiresAt: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type ComplianceDocFormValues = z.infer<typeof complianceDocSchema>
