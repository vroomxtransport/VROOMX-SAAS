import { z } from 'zod'

export const truckSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required'),
  truckType: z.enum(['7_car', '8_car', '9_car', 'flatbed', 'enclosed']).default('7_car'),
  truckStatus: z.enum(['active', 'inactive', 'maintenance']).default('active'),
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
  ownership: z.enum(['company', 'owner_operator']).optional().default('company'),
  notes: z.string().optional().or(z.literal('')),
})

export type TruckFormValues = z.infer<typeof truckSchema>
