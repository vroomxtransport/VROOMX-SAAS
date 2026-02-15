import { z } from 'zod'

export const fuelSchema = z.object({
  truckId: z.string().min(1, 'Truck is required').max(36),
  driverId: z.string().max(36).optional().or(z.literal('')),
  date: z.string().min(1, 'Date is required').max(200),
  gallons: z.coerce.number().min(0.001, 'Gallons must be greater than 0').max(1_000_000),
  costPerGallon: z.coerce.number().min(0.001, 'Cost per gallon is required').max(10_000_000),
  odometer: z.coerce.number().min(0).max(1_000_000).optional(),
  location: z.string().max(500).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type FuelFormValues = z.infer<typeof fuelSchema>
export type FuelFormInput = z.input<typeof fuelSchema>
