import { z } from 'zod'

export const documentSchema = z.object({
  documentType: z.string().min(1, 'Document type is required').max(200),
  fileName: z.string().min(1, 'File name is required').max(500),
  storagePath: z.string().min(1, 'Storage path is required').max(500),
  fileSize: z.coerce.number().positive().max(1_000_000).optional(),
  expiresAt: z.string().max(200).optional().or(z.literal('')),
})

export type DocumentFormValues = z.infer<typeof documentSchema>
export type DocumentFormInput = z.input<typeof documentSchema>
