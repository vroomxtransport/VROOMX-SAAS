import { z } from 'zod'

const uuid = z.string().uuid()

/**
 * Work-order header — create. Requires a shop and either a truck or trailer
 * (a WO must reference at least one piece of equipment to be useful).
 */
export const workOrderCreateSchema = z
  .object({
    shopId: uuid,
    truckId: uuid.optional(),
    trailerId: uuid.optional(),
    description: z.string().max(2000).optional().or(z.literal('')),
    maintenanceType: z
      .enum(['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other'])
      .default('other'),
    scheduledDate: z.string().max(40).optional().or(z.literal('')),
    odometer: z.coerce.number().int().min(0).max(10_000_000).optional(),
    notes: z.string().max(5000).optional().or(z.literal('')),
  })
  .refine((v) => !!v.truckId || !!v.trailerId, {
    message: 'Either a truck or a trailer must be selected',
    path: ['truckId'],
  })

/**
 * Work-order header — update. All fields optional. Status transitions go
 * through `setWorkOrderStatusSchema` instead because they have side effects.
 */
export const workOrderUpdateSchema = z.object({
  shopId: uuid.optional(),
  truckId: uuid.nullable().optional(),
  trailerId: uuid.nullable().optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  maintenanceType: z
    .enum(['preventive', 'repair', 'inspection', 'tire', 'oil_change', 'other'])
    .optional(),
  scheduledDate: z.string().max(40).optional().or(z.literal('')),
  odometer: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
})

export const setWorkOrderStatusSchema = z.object({
  id: uuid,
  status: z.enum(['new', 'in_progress', 'completed', 'closed', 'scheduled']),
})

/** A single labor or part line on the editable items grid. */
export const workOrderItemSchema = z.object({
  workOrderId: uuid,
  kind: z.enum(['labor', 'part']),
  description: z.string().min(1, 'Description is required').max(200),
  quantity: z.coerce.number().nonnegative().max(100_000).default(1),
  unitRate: z.coerce.number().min(-100_000_000).max(100_000_000).default(0),
  mechanicName: z.string().max(120).optional().or(z.literal('')),
  serviceDate: z.string().max(40).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
})

export const workOrderItemUpdateSchema = workOrderItemSchema
  .omit({ workOrderId: true })
  .partial()
  .extend({ id: uuid })

export const workOrderNoteCreateSchema = z.object({
  workOrderId: uuid,
  body: z.string().min(1, 'Note body is required').max(2000),
})

export const workOrderDuplicateSchema = z.object({ id: uuid })

/** Email-send dialog payload — recipient list + optional subject override. */
export const workOrderEmailSchema = z.object({
  id: uuid,
  recipients: z
    .array(z.string().email('Invalid recipient email'))
    .min(1, 'At least one recipient is required')
    .max(10, 'Maximum 10 recipients per send'),
  subject: z.string().max(200).optional().or(z.literal('')),
})

export type WorkOrderCreateInput = z.input<typeof workOrderCreateSchema>
export type WorkOrderUpdateInput = z.input<typeof workOrderUpdateSchema>
export type WorkOrderItemInput = z.input<typeof workOrderItemSchema>
export type WorkOrderItemUpdateInput = z.input<typeof workOrderItemUpdateSchema>
export type WorkOrderNoteInput = z.input<typeof workOrderNoteCreateSchema>
export type WorkOrderEmailInput = z.input<typeof workOrderEmailSchema>
