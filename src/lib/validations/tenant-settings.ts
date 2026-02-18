import { z } from 'zod'

export const factoringFeeRateSchema = z.object({
  factoringFeeRate: z.coerce.number().min(0, 'Rate must be 0 or higher').max(100, 'Rate cannot exceed 100%'),
})

export type FactoringFeeRateFormValues = z.infer<typeof factoringFeeRateSchema>
