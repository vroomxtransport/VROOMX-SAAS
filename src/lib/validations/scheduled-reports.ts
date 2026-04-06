import { z } from 'zod'

export const SCHEDULE_OPTIONS = [
  'daily',
  'weekly_monday',
  'weekly_friday',
  'monthly_1',
  'monthly_15',
] as const

export type ScheduleOption = (typeof SCHEDULE_OPTIONS)[number]

export const SCHEDULE_LABELS: Record<ScheduleOption, string> = {
  daily: 'Daily',
  weekly_monday: 'Weekly (Monday)',
  weekly_friday: 'Weekly (Friday)',
  monthly_1: 'Monthly (1st)',
  monthly_15: 'Monthly (15th)',
}

export const FORMAT_OPTIONS = ['pdf', 'excel', 'csv'] as const
export type FormatOption = (typeof FORMAT_OPTIONS)[number]

export const FORMAT_LABELS: Record<FormatOption, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  csv: 'CSV',
}

export const createScheduleSchema = z.object({
  reportId: z.string().uuid(),
  schedule: z.enum(SCHEDULE_OPTIONS),
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'Add at least one recipient'),
  format: z.enum(FORMAT_OPTIONS).default('pdf'),
  enabled: z.boolean().optional(),
})

export const updateScheduleSchema = createScheduleSchema
  .partial()
  .extend({ id: z.string().uuid() })

export const toggleScheduleSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
