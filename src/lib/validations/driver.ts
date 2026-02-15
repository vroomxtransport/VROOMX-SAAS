import { z } from 'zod'

export const driverSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(200),
  lastName: z.string().min(1, 'Last name is required').max(200),
  email: z.string().max(254).email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(500).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zip: z.string().max(20).optional().or(z.literal('')),
  licenseNumber: z.string().max(200).optional().or(z.literal('')),
  driverType: z.enum(['company', 'owner_operator']).default('company'),
  driverStatus: z.enum(['active', 'inactive']).default('active'),
  payType: z.enum(['percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile', 'per_car']).default('percentage_of_carrier_pay'),
  payRate: z.coerce.number().min(0, 'Pay rate must be 0 or more').max(100, 'Pay rate cannot exceed 100').default(0),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type DriverFormValues = z.infer<typeof driverSchema>
export type DriverFormInput = z.input<typeof driverSchema>
