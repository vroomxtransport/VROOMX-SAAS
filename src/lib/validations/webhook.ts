import { z } from 'zod'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/webhook-types'

export const createWebhookEndpointSchema = z.object({
  url: z.string()
    .url('Must be a valid URL')
    .refine(url => url.startsWith('https://'), { message: 'URL must use HTTPS' }),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, 'Select at least one event'),
  description: z.string().max(200).optional().or(z.literal('')),
})

export const updateWebhookEndpointSchema = z.object({
  id: z.string().uuid(),
  url: z.string()
    .url('Must be a valid URL')
    .refine(url => url.startsWith('https://'), { message: 'URL must use HTTPS' }),
  events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, 'Select at least one event'),
  description: z.string().max(200).optional().or(z.literal('')),
  enabled: z.boolean().optional(),
})

export const toggleWebhookEndpointSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
})

export const retryWebhookDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
})

export const rotateWebhookSecretSchema = z.object({
  id: z.string().uuid(),
})

export const deleteWebhookEndpointSchema = z.object({
  id: z.string().uuid(),
})

export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointSchema>
export type UpdateWebhookEndpointInput = z.infer<typeof updateWebhookEndpointSchema>
export type ToggleWebhookEndpointInput = z.infer<typeof toggleWebhookEndpointSchema>
export type RetryWebhookDeliveryInput = z.infer<typeof retryWebhookDeliverySchema>
export type RotateWebhookSecretInput = z.infer<typeof rotateWebhookSecretSchema>
export type DeleteWebhookEndpointInput = z.infer<typeof deleteWebhookEndpointSchema>
