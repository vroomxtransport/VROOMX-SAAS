import { z } from 'zod'

export const businessExpenseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.enum([
    'insurance', 'tolls_fixed', 'dispatch', 'parking', 'rent', 'telematics',
    'registration', 'salary', 'truck_lease', 'office_supplies', 'software',
    'professional_services', 'other',
  ]),
  recurrence: z.enum(['monthly', 'quarterly', 'annual', 'one_time']),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0').max(10_000_000),
  truck_id: z.string().uuid('Invalid truck ID').optional().or(z.literal('')),
  effective_from: z.string().min(1, 'Effective from date is required'),
  effective_to: z.string().optional().or(z.literal('')),
  notes: z.string().max(5000).optional(),
})

export type BusinessExpenseInput = z.input<typeof businessExpenseSchema>
export type BusinessExpenseFormData = z.infer<typeof businessExpenseSchema>
