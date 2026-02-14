import { z } from 'zod'

export const fuelSchema = z.object({
  truckId: z.string().min(1, 'Truck is required'),
  driverId: z.string().optional().or(z.literal('')),
  date: z.string().min(1, 'Date is required'),
  gallons: z.coerce.number().min(0.001, 'Gallons must be greater than 0'),
  costPerGallon: z.coerce.number().min(0.001, 'Cost per gallon is required'),
  odometer: z.coerce.number().min(0).optional(),
  location: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type FuelFormValues = z.infer<typeof fuelSchema>
export type FuelFormInput = z.input<typeof fuelSchema>
