import { z } from 'zod'

export const factoringFeeRateSchema = z.object({
  factoringFeeRate: z.coerce.number().min(0, 'Rate must be 0 or higher').max(100, 'Rate cannot exceed 100%'),
})

export type FactoringFeeRateFormValues = z.infer<typeof factoringFeeRateSchema>

export const companyProfileSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  dotNumber: z.string().max(20).optional().or(z.literal('')),
  mcNumber: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(2).optional().or(z.literal('')),
  zip: z.string().max(10).optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
})

export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>

export const brandingSchema = z.object({
  brandColorPrimary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
    .optional()
    .or(z.literal('')),
  brandColorSecondary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
    .optional()
    .or(z.literal('')),
  invoiceHeaderText: z.string().max(500).optional().or(z.literal('')),
  invoiceFooterText: z.string().max(500).optional().or(z.literal('')),
})

export type BrandingFormValues = z.infer<typeof brandingSchema>
