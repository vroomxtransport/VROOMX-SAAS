import { z } from 'zod'

export const fetchAuditLogsSchema = z.object({
  search: z.string().max(200).optional(),
  entityType: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
})

export type FetchAuditLogsInput = z.infer<typeof fetchAuditLogsSchema>

export const updateAlertConfigSchema = z.object({
  configs: z.array(z.object({
    entity_type: z.string().min(1).max(50),
    action: z.string().min(1).max(50),
    severity: z.enum(['info', 'warning', 'critical']),
    enabled: z.boolean(),
    notify_in_app: z.boolean(),
  })).max(100),
})

export type UpdateAlertConfigInput = z.infer<typeof updateAlertConfigSchema>

export const verifyIntegritySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

export const exportAuditLogsSchema = z.object({
  search: z.string().max(200).optional(),
  entityType: z.string().max(50).optional(),
  action: z.string().max(50).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['csv', 'json']).default('csv'),
})

export type ExportAuditLogsInput = z.infer<typeof exportAuditLogsSchema>
