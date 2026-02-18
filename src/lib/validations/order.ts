import { z } from 'zod'

// Step 1: Vehicle information
export const orderVehicleSchema = z.object({
  vehicleVin: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || val.length === 17, {
      message: 'VIN must be exactly 17 characters',
    }),
  vehicleYear: z.coerce.number().min(1900).max(new Date().getFullYear() + 2),
  vehicleMake: z.string().min(1, 'Make is required').max(200),
  vehicleModel: z.string().min(1, 'Model is required').max(200),
  vehicleType: z.string().max(200).optional().or(z.literal('')),
  vehicleColor: z.string().max(200).optional().or(z.literal('')),
})

// Step 2: Pickup and delivery locations
export const orderLocationSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required').max(500),
  pickupCity: z.string().min(1, 'Pickup city is required').max(500),
  pickupState: z.string().min(2, 'State required').max(2, 'Use 2-letter state code'),
  pickupZip: z.string().max(20).optional().or(z.literal('')),
  pickupContactName: z.string().max(200).optional().or(z.literal('')),
  pickupContactPhone: z.string().max(30).optional().or(z.literal('')),
  pickupDate: z.string().max(200).optional().or(z.literal('')),
  deliveryLocation: z.string().min(1, 'Delivery location is required').max(500),
  deliveryCity: z.string().min(1, 'Delivery city is required').max(500),
  deliveryState: z.string().min(2, 'State required').max(2, 'Use 2-letter state code'),
  deliveryZip: z.string().max(20).optional().or(z.literal('')),
  deliveryContactName: z.string().max(200).optional().or(z.literal('')),
  deliveryContactPhone: z.string().max(30).optional().or(z.literal('')),
  deliveryDate: z.string().max(200).optional().or(z.literal('')),
})

// Step 3: Pricing and broker assignment
export const orderPricingSchema = z.object({
  revenue: z.coerce.number().min(0, 'Revenue must be 0 or more').max(10_000_000),
  carrierPay: z.coerce.number().min(0, 'Carrier pay must be 0 or more').max(10_000_000),
  brokerFee: z.coerce.number().min(0, 'Broker fee must be 0 or more').max(10_000_000).default(0),
  localFee: z.coerce.number().min(0, 'Local fee must be 0 or more').max(10_000_000).default(0),
  driverPayRateOverride: z.coerce.number().min(0, 'Rate must be 0 or more').max(100, 'Rate cannot exceed 100%').optional(),
  distanceMiles: z.coerce.number().min(0, 'Distance must be 0 or more').max(1_000_000).optional(),
  paymentType: z.enum(['COD', 'COP', 'CHECK', 'BILL', 'SPLIT']).default('COP'),
  brokerId: z.string().max(36).uuid('Invalid broker ID').optional().or(z.literal('')),
  driverId: z.string().max(36).uuid('Invalid driver ID').optional().or(z.literal('')),
})

// Combined schema for server-side validation
export const createOrderSchema = orderVehicleSchema
  .merge(orderLocationSchema)
  .merge(orderPricingSchema)

export type OrderVehicleValues = z.infer<typeof orderVehicleSchema>
export type OrderLocationValues = z.infer<typeof orderLocationSchema>
export type OrderPricingValues = z.infer<typeof orderPricingSchema>
export type CreateOrderValues = z.infer<typeof createOrderSchema>

// Input types for react-hook-form (z.coerce fields have `unknown` input vs `number` output)
export type CreateOrderInput = z.input<typeof createOrderSchema>
