import { z } from 'zod'

/**
 * Input schema for `previewOrderDistance` — a read-only server action
 * used by the create-order form to show the user a live mileage + RPM
 * preview before saving. Pickup + delivery city/state are required so
 * Mapbox has enough signal to geocode; everything else is optional and
 * improves precision when present.
 */
export const previewOrderDistanceSchema = z.object({
  pickupLocation: z.string().max(500).optional().nullable(),
  pickupCity: z.string().min(1, 'Pickup city required').max(500),
  pickupState: z.string().length(2, 'Use 2-letter state code'),
  pickupZip: z.string().max(20).optional().nullable(),
  deliveryLocation: z.string().max(500).optional().nullable(),
  deliveryCity: z.string().min(1, 'Delivery city required').max(500),
  deliveryState: z.string().length(2, 'Use 2-letter state code'),
  deliveryZip: z.string().max(20).optional().nullable(),
  revenue: z.number().min(0).max(10_000_000).optional().nullable(),
  brokerFee: z.number().min(0).max(10_000_000).optional().nullable(),
  localFee: z.number().min(0).max(10_000_000).optional().nullable(),
})

export type PreviewOrderDistanceInput = z.infer<typeof previewOrderDistanceSchema>

export type PreviewOrderDistanceErrorCode =
  | 'NO_TOKEN'
  | 'GEOCODE_MISS'
  | 'ROUTE_FAILED'
