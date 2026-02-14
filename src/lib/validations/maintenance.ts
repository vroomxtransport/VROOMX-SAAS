import { z } from 'zod'

export const maintenanceSchema = z.object({
  truckId: z.string().min(1, 'Truck is required'),
  maintenanceType: z.enum(['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other']).default('other'),
  status: z.enum(['scheduled', 'in_progress', 'completed']).default('scheduled'),
  description: z.string().optional().or(z.literal('')),
  vendor: z.string().optional().or(z.literal('')),
  cost: z.coerce.number().min(0).default(0),
  scheduledDate: z.string().optional().or(z.literal('')),
  odometer: z.coerce.number().min(0).optional(),
  notes: z.string().optional().or(z.literal('')),
})

export type MaintenanceFormValues = z.infer<typeof maintenanceSchema>
export type MaintenanceFormInput = z.input<typeof maintenanceSchema>
