import { z } from 'zod'

export const localRunSchema = z.object({
  terminalId: z.string().uuid().optional().or(z.literal('')),
  driverId: z.string().uuid().optional().or(z.literal('')),
  truckId: z.string().uuid().optional().or(z.literal('')),
  type: z.enum(['pickup_to_terminal', 'delivery_from_terminal', 'standalone']),
  scheduledDate: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type LocalRunFormValues = z.infer<typeof localRunSchema>
