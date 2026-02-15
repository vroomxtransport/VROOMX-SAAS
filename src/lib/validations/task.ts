import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().max(200).optional().or(z.literal('')),
  assignedTo: z.string().max(36).optional().or(z.literal('')),
  assignedName: z.string().max(200).optional().or(z.literal('')),
  category: z.string().max(200).optional().or(z.literal('')),
})

export type TaskFormValues = z.infer<typeof taskSchema>
export type TaskFormInput = z.input<typeof taskSchema>
