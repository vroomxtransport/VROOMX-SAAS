export const WEBHOOK_EVENT_TYPES = [
  'order.created',
  'order.updated',
  'order.status_changed',
  'trip.created',
  'trip.updated',
  'trip.status_changed',
  'payment.received',
  'invoice.created',
  'driver.status_changed',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number]

export const WEBHOOK_EVENT_GROUPS: Record<string, readonly WebhookEventType[]> = {
  Orders: ['order.created', 'order.updated', 'order.status_changed'],
  Trips: ['trip.created', 'trip.updated', 'trip.status_changed'],
  Billing: ['payment.received', 'invoice.created'],
  Drivers: ['driver.status_changed'],
} as const

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'exhausted'

export interface WebhookPayload {
  id: string
  event: WebhookEventType
  tenant_id: string
  created_at: string
  data: Record<string, unknown>
}

// Retry backoff in seconds: 1min, 5min, 30min, 2hr, 24hr
export const RETRY_BACKOFF_SECONDS = [60, 300, 1800, 7200, 86400] as const
