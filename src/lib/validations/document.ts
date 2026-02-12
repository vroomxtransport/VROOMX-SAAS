import { z } from 'zod'

export const documentSchema = z.object({
  documentType: z.string().min(1, 'Document type is required'),
  fileName: z.string().min(1, 'File name is required'),
  storagePath: z.string().min(1, 'Storage path is required'),
  fileSize: z.coerce.number().positive().optional(),
  expiresAt: z.string().optional().or(z.literal('')),
})

export type DocumentFormValues = z.infer<typeof documentSchema>
export type DocumentFormInput = z.input<typeof documentSchema>
