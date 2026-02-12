import { z } from 'zod'

export const trailerSchema = z.object({
  trailerNumber: z.string().min(1, 'Trailer number is required'),
  trailerType: z.enum(['open', 'enclosed', 'flatbed']).default('open'),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  year: z.coerce.number().min(1900).max(2030).optional(),
  make: z.string().optional().or(z.literal('')),
  model: z.string().optional().or(z.literal('')),
  vin: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || val.length === 17, {
      message: 'VIN must be exactly 17 characters',
    }),
  notes: z.string().optional().or(z.literal('')),
})

export type TrailerFormValues = z.infer<typeof trailerSchema>
export type TrailerFormInput = z.input<typeof trailerSchema>
