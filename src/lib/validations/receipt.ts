import { z } from 'zod'

export const receiptRecipientEnum = z.enum(['pickup', 'delivery', 'broker'])
export type ReceiptRecipient = z.infer<typeof receiptRecipientEnum>

export const sendReceiptSchema = z.object({
  recipient: receiptRecipientEnum,
  email: z.string().email('Invalid email address').max(200),
})

export type SendReceiptInput = z.infer<typeof sendReceiptSchema>
