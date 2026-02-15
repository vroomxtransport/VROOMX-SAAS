import { z } from 'zod'

export const tripExpenseSchema = z.object({
  category: z.enum(['fuel', 'tolls', 'repairs', 'lodging', 'misc']),
  custom_label: z.string().max(200).optional(),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(10_000_000),
  notes: z.string().max(5000).optional(),
  expense_date: z.string().max(200).optional(),
})

export type TripExpenseInput = z.input<typeof tripExpenseSchema>
export type TripExpenseFormData = z.infer<typeof tripExpenseSchema>
