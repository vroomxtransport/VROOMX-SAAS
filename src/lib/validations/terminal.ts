import { z } from 'zod'

export const terminalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(200).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zip: z.string().max(10).optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
  serviceRadiusMiles: z.coerce.number().min(0).max(1000).default(200),
  isActive: z.boolean().default(true),
  autoCreateLocalDrives: z.boolean().default(true),
  autoCreateStates: z.array(z.string().max(2)).optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type TerminalFormValues = z.infer<typeof terminalSchema>
