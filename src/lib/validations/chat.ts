import { z } from 'zod'

export const messageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty'),
})

export const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required'),
  description: z.string().optional().or(z.literal('')),
})

export type MessageFormValues = z.infer<typeof messageSchema>
export type ChannelFormValues = z.infer<typeof channelSchema>
