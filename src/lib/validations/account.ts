import { z } from 'zod'

export const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT', {
    message: 'Please type "DELETE MY ACCOUNT" to confirm',
  }),
})
