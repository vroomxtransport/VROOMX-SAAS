import { z } from 'zod'

export const driverSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
  licenseNumber: z.string().optional().or(z.literal('')),
  driverType: z.enum(['company', 'owner_operator']).default('company'),
  driverStatus: z.enum(['active', 'inactive']).default('active'),
  payType: z.enum(['percentage_of_carrier_pay', 'dispatch_fee_percent', 'per_mile']).default('percentage_of_carrier_pay'),
  payRate: z.coerce.number().min(0, 'Pay rate must be 0 or more').max(100, 'Pay rate cannot exceed 100').default(0),
  notes: z.string().optional().or(z.literal('')),
})

export type DriverFormValues = z.infer<typeof driverSchema>
export type DriverFormInput = z.input<typeof driverSchema>
