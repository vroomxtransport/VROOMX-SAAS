import { z } from 'zod'

export const localDriveSchema = z.object({
  driverId: z.string().max(36).optional().or(z.literal('')),
  truckId: z.string().max(36).optional().or(z.literal('')),
  orderId: z.string().uuid().optional().or(z.literal('')),
  type: z.enum(['pickup_to_terminal', 'delivery_from_terminal', 'standalone']).default('standalone'),
  terminalId: z.string().uuid().optional().or(z.literal('')),
  localRunId: z.string().uuid().optional().or(z.literal('')),
  tripId: z.string().uuid().optional().or(z.literal('')),
  pickupLocation: z.string().max(500).optional().or(z.literal('')),
  pickupCity: z.string().max(500).optional().or(z.literal('')),
  pickupState: z.string().max(2).optional().or(z.literal('')),
  deliveryLocation: z.string().max(500).optional().or(z.literal('')),
  deliveryCity: z.string().max(500).optional().or(z.literal('')),
  deliveryState: z.string().max(2).optional().or(z.literal('')),
  scheduledDate: z.string().max(200).optional().or(z.literal('')),
  revenue: z.coerce.number().min(0).max(10_000_000).default(0),
  expenseAmount: z.coerce.number().min(0).max(10_000_000).default(0),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type LocalDriveFormValues = z.infer<typeof localDriveSchema>
export type LocalDriveFormInput = z.input<typeof localDriveSchema>
