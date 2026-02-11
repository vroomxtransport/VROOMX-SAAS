import { z } from 'zod'

export const brokerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zip: z.string().optional().or(z.literal('')),
  paymentTerms: z.enum(['NET15', 'NET30', 'NET45', 'NET60']).optional(),
  factoringCompany: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export type BrokerFormValues = z.infer<typeof brokerSchema>
