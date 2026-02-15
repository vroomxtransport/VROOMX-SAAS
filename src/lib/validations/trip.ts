import { z } from 'zod'

export const tripSchema = z.object({
  driver_id: z.string().min(1, 'Driver is required').max(36),
  truck_id: z.string().min(1, 'Truck is required').max(36),
  start_date: z.string().min(1, 'Start date is required').max(200),
  end_date: z.string().min(1, 'End date is required').max(200),
  carrier_pay: z.coerce.number().min(0).max(10_000_000).default(0),
  notes: z.string().max(5000).optional(),
})

export type TripInput = z.input<typeof tripSchema>
export type TripFormData = z.infer<typeof tripSchema>
