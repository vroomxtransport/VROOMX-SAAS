import { z } from 'zod'

export const chatAttachmentSchema = z.object({
  fileName: z.string().min(1).max(500),
  storagePath: z.string().min(1).max(500),
  fileSize: z.coerce.number().positive().max(10 * 1024 * 1024),
  mimeType: z.string().max(100),
})

export const chatMentionSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().min(1).max(100),
})

export const messageSchema = z.object({
  content: z.string().max(5000).optional(),
  attachments: z.array(chatAttachmentSchema).max(5).optional(),
  mentions: z.array(chatMentionSchema).max(20).optional(),
}).refine(
  (d) => (d.content && d.content.trim().length > 0) || (d.attachments && d.attachments.length > 0),
  { message: 'Message must have text or at least one attachment' }
)

export const channelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
})

export type MessageFormValues = z.infer<typeof messageSchema>
export type ChannelFormValues = z.infer<typeof channelSchema>
export type ChatAttachmentValues = z.infer<typeof chatAttachmentSchema>
