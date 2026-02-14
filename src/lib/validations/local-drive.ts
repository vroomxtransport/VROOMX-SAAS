import { z } from 'zod'

export const localDriveSchema = z.object({
  driverId: z.string().optional().or(z.literal('')),
  truckId: z.string().optional().or(z.literal('')),
  pickupLocation: z.string().optional().or(z.literal('')),
  pickupCity: z.string().optional().or(z.literal('')),
  pickupState: z.string().optional().or(z.literal('')),
  deliveryLocation: z.string().optional().or(z.literal('')),
  deliveryCity: z.string().optional().or(z.literal('')),
  deliveryState: z.string().optional().or(z.literal('')),
  scheduledDate: z.string().optional().or(z.literal('')),
  revenue: z.coerce.number().min(0).default(0),
  notes: z.string().optional().or(z.literal('')),
})

export type LocalDriveFormValues = z.infer<typeof localDriveSchema>
export type LocalDriveFormInput = z.input<typeof localDriveSchema>
