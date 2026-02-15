import { z } from 'zod'

export const brokerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().max(254).email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(500).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zip: z.string().max(20).optional().or(z.literal('')),
  paymentTerms: z.enum(['NET15', 'NET30', 'NET45', 'NET60']).optional(),
  factoringCompany: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type BrokerFormValues = z.infer<typeof brokerSchema>
