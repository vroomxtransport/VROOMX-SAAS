import { z } from 'zod'

export const inviteSchema = z.object({
  email: z.string().max(254).email('Invalid email address'),
  role: z.string().min(1, 'Role is required').max(100),
})

export type InviteInput = z.input<typeof inviteSchema>
