import { z } from 'zod'

/** Shop directory entry — internal bay or external vendor where work happens. */
export const shopSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  kind: z.enum(['internal', 'external']).default('external'),
  contactName: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(80).optional().or(z.literal('')),
  state: z.string().max(80).optional().or(z.literal('')),
  zip: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

export type ShopFormValues = z.infer<typeof shopSchema>
export type ShopFormInput = z.input<typeof shopSchema>
