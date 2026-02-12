import { z } from 'zod'

export const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'dispatcher', 'viewer']),
})

export type InviteInput = z.input<typeof inviteSchema>
