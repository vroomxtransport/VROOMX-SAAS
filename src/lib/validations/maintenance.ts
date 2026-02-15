import { z } from 'zod'

export const maintenanceSchema = z.object({
  truckId: z.string().min(1, 'Truck is required').max(36),
  maintenanceType: z.enum(['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other']).default('other'),
  status: z.enum(['scheduled', 'in_progress', 'completed']).default('scheduled'),
  description: z.string().max(5000).optional().or(z.literal('')),
  vendor: z.string().max(200).optional().or(z.literal('')),
  cost: z.coerce.number().min(0).max(10_000_000).default(0),
  scheduledDate: z.string().max(200).optional().or(z.literal('')),
  odometer: z.coerce.number().min(0).max(1_000_000).optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>
export type MaintenanceFormInput = z.input<typeof maintenanceSchema>
