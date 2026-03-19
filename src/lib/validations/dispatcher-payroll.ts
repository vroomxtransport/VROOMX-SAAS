import { z } from 'zod'

export const dispatcherPayConfigSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  payType: z.enum(['fixed_salary', 'performance_revenue']),
  payRate: z.coerce.number().min(0.01, 'Pay rate must be greater than 0').max(10_000_000),
  payFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  effectiveTo: z.string().optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export type DispatcherPayConfigFormInput = z.input<typeof dispatcherPayConfigSchema>
export type DispatcherPayConfigFormValues = z.infer<typeof dispatcherPayConfigSchema>

export const generatePayrollPeriodSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
})

export type GeneratePayrollPeriodFormInput = z.input<typeof generatePayrollPeriodSchema>

export const batchGeneratePayrollSchema = z.object({
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
})

export type BatchGeneratePayrollFormInput = z.input<typeof batchGeneratePayrollSchema>
