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
  vehicleMake: z.string().min(1, 'Make is required'),
  vehicleModel: z.string().min(1, 'Model is required'),
  vehicleType: z.string().optional().or(z.literal('')),
  vehicleColor: z.string().optional().or(z.literal('')),
})

// Step 2: Pickup and delivery locations
export const orderLocationSchema = z.object({
  pickupLocation: z.string().min(1, 'Pickup location is required'),
  pickupCity: z.string().min(1, 'Pickup city is required'),
  pickupState: z.string().min(2, 'State required').max(2, 'Use 2-letter state code'),
  pickupZip: z.string().optional().or(z.literal('')),
  pickupContactName: z.string().optional().or(z.literal('')),
  pickupContactPhone: z.string().optional().or(z.literal('')),
  pickupDate: z.string().optional().or(z.literal('')),
  deliveryLocation: z.string().min(1, 'Delivery location is required'),
  deliveryCity: z.string().min(1, 'Delivery city is required'),
  deliveryState: z.string().min(2, 'State required').max(2, 'Use 2-letter state code'),
  deliveryZip: z.string().optional().or(z.literal('')),
  deliveryContactName: z.string().optional().or(z.literal('')),
  deliveryContactPhone: z.string().optional().or(z.literal('')),
  deliveryDate: z.string().optional().or(z.literal('')),
})

// Step 3: Pricing and broker assignment
export const orderPricingSchema = z.object({
  revenue: z.coerce.number().min(0, 'Revenue must be 0 or more'),
  carrierPay: z.coerce.number().min(0, 'Carrier pay must be 0 or more'),
  brokerFee: z.coerce.number().min(0, 'Broker fee must be 0 or more').default(0),
  paymentType: z.enum(['COD', 'COP', 'CHECK', 'BILL', 'SPLIT']).default('COP'),
  brokerId: z.string().uuid('Invalid broker ID').optional().or(z.literal('')),
  driverId: z.string().uuid('Invalid driver ID').optional().or(z.literal('')),
})

// Combined schema for server-side validation
export const createOrderSchema = orderVehicleSchema
  .merge(orderLocationSchema)
  .merge(orderPricingSchema)

export type OrderVehicleValues = z.infer<typeof orderVehicleSchema>
export type OrderLocationValues = z.infer<typeof orderLocationSchema>
export type OrderPricingValues = z.infer<typeof orderPricingSchema>
export type CreateOrderValues = z.infer<typeof createOrderSchema>
