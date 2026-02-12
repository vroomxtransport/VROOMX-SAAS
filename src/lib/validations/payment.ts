import { z } from 'zod'

export const recordPaymentSchema = z.object({
  amount: z.coerce.number()
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  notes: z.string().optional().or(z.literal('')),
})

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>
