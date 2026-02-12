import { z } from 'zod'

export const tripSchema = z.object({
  driver_id: z.string().min(1, 'Driver is required'),
  truck_id: z.string().min(1, 'Truck is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  carrier_pay: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
})

export type TripInput = z.input<typeof tripSchema>
export type TripFormData = z.infer<typeof tripSchema>
