import { z } from 'zod'

export const safetyEventSchema = z.object({
  eventType: z.enum(['incident', 'claim', 'dot_inspection']),
  severity: z.enum(['minor', 'moderate', 'severe', 'critical']),
  status: z.enum(['open', 'under_review', 'resolved', 'closed']).optional(),
  eventDate: z.string().min(1, 'Event date is required'),
  driverId: z.string().uuid().optional().or(z.literal('')),
  truckId: z.string().uuid().optional().or(z.literal('')),
  orderId: z.string().uuid().optional().or(z.literal('')),
  vehicleVin: z.string().max(17).optional().or(z.literal('')),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  location: z.string().max(500).optional().or(z.literal('')),
  locationState: z.string().max(2).optional().or(z.literal('')),
  financialAmount: z.coerce.number().min(0).optional(),
  insuranceClaimNumber: z.string().max(100).optional().or(z.literal('')),
  deductionAmount: z.coerce.number().min(0).optional(),
  inspectionLevel: z.enum(['I', 'II', 'III', 'IV', 'V']).optional().or(z.literal('')),
  violationsCount: z.coerce.number().int().min(0).optional(),
  outOfService: z.boolean().optional(),
  resolutionNotes: z.string().max(5000).optional().or(z.literal('')),
})

export type SafetyEventFormValues = z.infer<typeof safetyEventSchema>

export const resolveSafetyEventSchema = z.object({
  resolutionNotes: z.string().max(5000).optional().or(z.literal('')),
})

export type ResolveSafetyEventFormValues = z.infer<typeof resolveSafetyEventSchema>
