import { z } from 'zod'
import { ALERT_METRICS_BY_ID } from '@/lib/alerts/alert-metrics'

const VALID_METRIC_IDS = Object.keys(ALERT_METRICS_BY_ID)
const VALID_OPERATORS = ['gt', 'lt', 'gte', 'lte'] as const

export const createAlertRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  metric: z.string().refine(
    (v) => VALID_METRIC_IDS.includes(v),
    { message: 'Invalid metric' }
  ),
  operator: z.enum(VALID_OPERATORS),
  threshold: z.coerce.number()
    .min(-9_999_999, 'Threshold too small')
    .max(9_999_999, 'Threshold too large'),
  notifyInApp: z.boolean().default(true),
  notifyEmail: z.boolean().default(false),
  emailRecipients: z
    .array(z.string().email('Invalid email address'))
    .max(20, 'Too many email recipients')
    .optional()
    .nullable(),
  cooldownMinutes: z.coerce.number().int().min(1).max(10_080).default(1440), // max 1 week
})

export const updateAlertRuleSchema = createAlertRuleSchema.extend({
  id: z.string().uuid('Invalid alert rule ID'),
})

export const deleteAlertRuleSchema = z.object({
  id: z.string().uuid('Invalid alert rule ID'),
})

export const toggleAlertRuleSchema = z.object({
  id: z.string().uuid('Invalid alert rule ID'),
  enabled: z.boolean(),
})

export type CreateAlertRuleInput = z.input<typeof createAlertRuleSchema>
export type CreateAlertRuleData = z.infer<typeof createAlertRuleSchema>
export type UpdateAlertRuleInput = z.input<typeof updateAlertRuleSchema>
export type UpdateAlertRuleData = z.infer<typeof updateAlertRuleSchema>
