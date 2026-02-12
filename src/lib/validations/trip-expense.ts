import { z } from 'zod'

export const tripExpenseSchema = z.object({
  category: z.enum(['fuel', 'tolls', 'repairs', 'lodging', 'misc']),
  custom_label: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  notes: z.string().optional(),
  expense_date: z.string().optional(),
})

export type TripExpenseInput = z.input<typeof tripExpenseSchema>
export type TripExpenseFormData = z.infer<typeof tripExpenseSchema>
