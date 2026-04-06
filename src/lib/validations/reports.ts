import { z } from 'zod'

export const reportConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  dataSource: z.enum(['orders', 'trips', 'drivers', 'trucks', 'brokers', 'expenses']),
  metrics: z.array(z.string()).min(1, 'Select at least one metric'),
  dimensions: z.array(z.string()),
  filters: z.array(z.object({
    dimensionId: z.string(),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
    value: z.union([z.string(), z.array(z.string()), z.number()]),
  })),
  chartType: z.enum(['table', 'bar', 'line', 'pie', 'area']),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
})

export const createReportSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  config: reportConfigSchema,
  isShared: z.boolean().optional(),
})

export const updateReportSchema = createReportSchema.partial().extend({
  id: z.string().uuid(),
})

export const createViewSchema = z.object({
  pageKey: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(100),
  filters: z.record(z.string(), z.unknown()),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export const updateViewSchema = createViewSchema.partial().extend({
  id: z.string().uuid(),
})

export type ReportFormValues = z.infer<typeof createReportSchema>
export type ViewFormValues = z.infer<typeof createViewSchema>
