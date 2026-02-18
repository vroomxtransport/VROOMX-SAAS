'use server'

import { authorize, safeError } from '@/lib/authz'
import { createOrderSchema } from '@/lib/validations/order'
import { geocodeAndSaveOrder } from '@/lib/geocoding-helpers'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/types'

// Status workflow: defines the linear progression of order statuses
const STATUS_ORDER: OrderStatus[] = ['new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid']

// Statuses that allow cancellation (before delivery)
const CANCELLABLE_STATUSES: OrderStatus[] = ['new', 'assigned', 'picked_up']

const VALID_STATUSES: OrderStatus[] = ['new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled']

export async function createOrder(data: unknown) {
  const parsed = createOrderSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('orders.create', { rateLimit: { key: 'createOrder', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Map camelCase form fields to snake_case DB columns
  // Do NOT set order_number -- the DB trigger generates it atomically
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      vehicle_vin: v.vehicleVin || null,
      vehicle_year: v.vehicleYear,
      vehicle_make: v.vehicleMake,
      vehicle_model: v.vehicleModel,
      vehicle_type: v.vehicleType || null,
      vehicle_color: v.vehicleColor || null,
      pickup_location: v.pickupLocation,
      pickup_city: v.pickupCity,
      pickup_state: v.pickupState,
      pickup_zip: v.pickupZip || null,
      pickup_contact_name: v.pickupContactName || null,
      pickup_contact_phone: v.pickupContactPhone || null,
      pickup_date: v.pickupDate || null,
      delivery_location: v.deliveryLocation,
      delivery_city: v.deliveryCity,
      delivery_state: v.deliveryState,
      delivery_zip: v.deliveryZip || null,
      delivery_contact_name: v.deliveryContactName || null,
      delivery_contact_phone: v.deliveryContactPhone || null,
      delivery_date: v.deliveryDate || null,
      revenue: String(v.revenue),
      carrier_pay: String(v.carrierPay),
      broker_fee: String(v.brokerFee),
      local_fee: String(v.localFee),
      driver_pay_rate_override: v.driverPayRateOverride ? String(v.driverPayRateOverride) : null,
      payment_type: v.paymentType,
      broker_id: v.brokerId || null,
      driver_id: v.driverId || null,
      distance_miles: v.distanceMiles ? String(v.distanceMiles) : null,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createOrder') }
  }

  // Fire-and-forget geocoding — coordinates appear via realtime invalidation
  geocodeAndSaveOrder(supabase, order.id, tenantId, {
    pickupLocation: v.pickupLocation,
    pickupCity: v.pickupCity,
    pickupState: v.pickupState,
    pickupZip: v.pickupZip,
    deliveryLocation: v.deliveryLocation,
    deliveryCity: v.deliveryCity,
    deliveryState: v.deliveryState,
    deliveryZip: v.deliveryZip,
  }).catch((err) => console.error('[geocoding] createOrder fire-and-forget failed:', err))

  revalidatePath('/orders')
  return { success: true, data: order }
}

export async function updateOrder(id: string, data: unknown) {
  const parsed = createOrderSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('orders.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (v.vehicleVin !== undefined) updateData.vehicle_vin = v.vehicleVin || null
  if (v.vehicleYear !== undefined) updateData.vehicle_year = v.vehicleYear
  if (v.vehicleMake !== undefined) updateData.vehicle_make = v.vehicleMake
  if (v.vehicleModel !== undefined) updateData.vehicle_model = v.vehicleModel
  if (v.vehicleType !== undefined) updateData.vehicle_type = v.vehicleType || null
  if (v.vehicleColor !== undefined) updateData.vehicle_color = v.vehicleColor || null
  if (v.pickupLocation !== undefined) updateData.pickup_location = v.pickupLocation
  if (v.pickupCity !== undefined) updateData.pickup_city = v.pickupCity
  if (v.pickupState !== undefined) updateData.pickup_state = v.pickupState
  if (v.pickupZip !== undefined) updateData.pickup_zip = v.pickupZip || null
  if (v.pickupContactName !== undefined) updateData.pickup_contact_name = v.pickupContactName || null
  if (v.pickupContactPhone !== undefined) updateData.pickup_contact_phone = v.pickupContactPhone || null
  if (v.pickupDate !== undefined) updateData.pickup_date = v.pickupDate || null
  if (v.deliveryLocation !== undefined) updateData.delivery_location = v.deliveryLocation
  if (v.deliveryCity !== undefined) updateData.delivery_city = v.deliveryCity
  if (v.deliveryState !== undefined) updateData.delivery_state = v.deliveryState
  if (v.deliveryZip !== undefined) updateData.delivery_zip = v.deliveryZip || null
  if (v.deliveryContactName !== undefined) updateData.delivery_contact_name = v.deliveryContactName || null
  if (v.deliveryContactPhone !== undefined) updateData.delivery_contact_phone = v.deliveryContactPhone || null
  if (v.deliveryDate !== undefined) updateData.delivery_date = v.deliveryDate || null
  if (v.revenue !== undefined) updateData.revenue = String(v.revenue)
  if (v.carrierPay !== undefined) updateData.carrier_pay = String(v.carrierPay)
  if (v.brokerFee !== undefined) updateData.broker_fee = String(v.brokerFee)
  if (v.localFee !== undefined) updateData.local_fee = String(v.localFee)
  if (v.driverPayRateOverride !== undefined) updateData.driver_pay_rate_override = v.driverPayRateOverride ? String(v.driverPayRateOverride) : null
  if (v.paymentType !== undefined) updateData.payment_type = v.paymentType
  if (v.brokerId !== undefined) updateData.broker_id = v.brokerId || null
  if (v.driverId !== undefined) updateData.driver_id = v.driverId || null
  if (v.distanceMiles !== undefined) updateData.distance_miles = v.distanceMiles ? String(v.distanceMiles) : null

  // If address fields changed, clear stale coordinates for re-geocoding
  const pickupAddressChanged = v.pickupLocation !== undefined || v.pickupCity !== undefined || v.pickupState !== undefined || v.pickupZip !== undefined
  const deliveryAddressChanged = v.deliveryLocation !== undefined || v.deliveryCity !== undefined || v.deliveryState !== undefined || v.deliveryZip !== undefined

  if (pickupAddressChanged) {
    updateData.pickup_latitude = null
    updateData.pickup_longitude = null
  }
  if (deliveryAddressChanged) {
    updateData.delivery_latitude = null
    updateData.delivery_longitude = null
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateOrder') }
  }

  // Re-geocode if address fields changed
  if (pickupAddressChanged || deliveryAddressChanged) {
    geocodeAndSaveOrder(supabase, id, tenantId, {
      pickupLocation: order.pickup_location,
      pickupCity: order.pickup_city,
      pickupState: order.pickup_state,
      pickupZip: order.pickup_zip,
      deliveryLocation: order.delivery_location,
      deliveryCity: order.delivery_city,
      deliveryState: order.delivery_state,
      deliveryZip: order.delivery_zip,
    }).catch((err) => console.error('[geocoding] updateOrder fire-and-forget failed:', err))
  }

  revalidatePath('/orders')
  return { success: true, data: order }
}

export async function deleteOrder(id: string) {
  const auth = await authorize('orders.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteOrder') }
  }

  revalidatePath('/orders')
  return { success: true }
}

export async function updateOrderStatus(
  id: string,
  newStatus: string,
  reason?: string
) {
  if (!VALID_STATUSES.includes(newStatus as OrderStatus)) {
    return { error: `Invalid status: ${newStatus}` }
  }

  if (newStatus === 'cancelled' && !reason?.trim()) {
    return { error: 'A reason is required when cancelling an order' }
  }

  const auth = await authorize('orders.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Build update payload
  const updateData: Record<string, unknown> = {
    status: newStatus,
  }

  if (newStatus === 'cancelled') {
    updateData.cancelled_reason = reason!.trim()
  }

  if (newStatus === 'picked_up') {
    updateData.actual_pickup_date = new Date().toISOString()
  }

  if (newStatus === 'delivered') {
    updateData.actual_delivery_date = new Date().toISOString()
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateOrderStatus') }
  }

  revalidatePath(`/orders/${id}`)
  revalidatePath('/orders')
  return { success: true, data: order }
}

// ============================================================================
// CSV Batch Import
// ============================================================================

/** A single row from a mapped CSV import */
export interface CsvOrderRow {
  vehicle_vin?: string
  vehicle_year?: string | number
  vehicle_make?: string
  vehicle_model?: string
  vehicle_color?: string
  vehicle_type?: string
  pickup_location?: string
  pickup_city?: string
  pickup_state?: string
  pickup_zip?: string
  pickup_contact_name?: string
  pickup_contact_phone?: string
  pickup_date?: string
  delivery_location?: string
  delivery_city?: string
  delivery_state?: string
  delivery_zip?: string
  delivery_contact_name?: string
  delivery_contact_phone?: string
  delivery_date?: string
  revenue?: string | number
  carrier_pay?: string | number
  broker_fee?: string | number
  payment_type?: string
}

export interface BatchImportResult {
  created: number
  errors: { row: number; message: string }[]
}

export async function batchCreateOrders(
  rows: CsvOrderRow[]
): Promise<BatchImportResult> {
  const auth = await authorize('orders.create', { rateLimit: { key: 'batchCreateOrders', limit: 5, windowMs: 60_000 } })
  if (!auth.ok) return { created: 0, errors: [{ row: 0, message: auth.error }] }
  const { supabase, tenantId } = auth.ctx

  // Cap batch size to prevent abuse
  if (rows.length > 500) {
    return { created: 0, errors: [{ row: 0, message: 'Maximum 500 rows per batch import' }] }
  }

  const result: BatchImportResult = { created: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    // Validate required fields
    const missingFields: string[] = []
    if (!r.pickup_city?.trim()) missingFields.push('pickup_city')
    if (!r.pickup_state?.trim()) missingFields.push('pickup_state')
    if (!r.delivery_city?.trim()) missingFields.push('delivery_city')
    if (!r.delivery_state?.trim()) missingFields.push('delivery_state')

    if (missingFields.length > 0) {
      result.errors.push({
        row: i + 1,
        message: `Missing required fields: ${missingFields.join(', ')}`,
      })
      continue
    }

    // Validate state codes are 2 characters
    if (r.pickup_state && r.pickup_state.trim().length !== 2) {
      result.errors.push({ row: i + 1, message: 'pickup_state must be a 2-letter state code' })
      continue
    }
    if (r.delivery_state && r.delivery_state.trim().length !== 2) {
      result.errors.push({ row: i + 1, message: 'delivery_state must be a 2-letter state code' })
      continue
    }

    // Validate VIN length if provided
    const vin = r.vehicle_vin?.trim()
    if (vin && vin.length !== 17) {
      result.errors.push({ row: i + 1, message: 'VIN must be exactly 17 characters' })
      continue
    }

    // Parse numeric fields
    const year = r.vehicle_year ? Number(r.vehicle_year) : null
    if (year !== null && (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2)) {
      result.errors.push({ row: i + 1, message: 'Invalid vehicle year' })
      continue
    }

    const revenue = r.revenue ? Number(r.revenue) : 0
    const carrierPay = r.carrier_pay ? Number(r.carrier_pay) : 0
    const brokerFee = r.broker_fee ? Number(r.broker_fee) : 0

    if (isNaN(revenue) || isNaN(carrierPay) || isNaN(brokerFee)) {
      result.errors.push({ row: i + 1, message: 'Invalid numeric value for revenue, carrier_pay, or broker_fee' })
      continue
    }

    // Validate payment_type if provided
    const validPaymentTypes = ['COD', 'COP', 'CHECK', 'BILL', 'SPLIT']
    const paymentType = r.payment_type?.trim().toUpperCase() || 'COP'
    if (!validPaymentTypes.includes(paymentType)) {
      result.errors.push({ row: i + 1, message: `Invalid payment_type: ${r.payment_type}. Must be one of: ${validPaymentTypes.join(', ')}` })
      continue
    }

    const { error } = await supabase.from('orders').insert({
      tenant_id: tenantId,
      status: 'new',
      vehicle_vin: vin || null,
      vehicle_year: year,
      vehicle_make: r.vehicle_make?.trim() || null,
      vehicle_model: r.vehicle_model?.trim() || null,
      vehicle_color: r.vehicle_color?.trim() || null,
      vehicle_type: r.vehicle_type?.trim() || null,
      pickup_location: r.pickup_location?.trim() || r.pickup_city!.trim(),
      pickup_city: r.pickup_city!.trim(),
      pickup_state: r.pickup_state!.trim().toUpperCase(),
      pickup_zip: r.pickup_zip?.trim() || null,
      pickup_contact_name: r.pickup_contact_name?.trim() || null,
      pickup_contact_phone: r.pickup_contact_phone?.trim() || null,
      pickup_date: r.pickup_date?.trim() || null,
      delivery_location: r.delivery_location?.trim() || r.delivery_city!.trim(),
      delivery_city: r.delivery_city!.trim(),
      delivery_state: r.delivery_state!.trim().toUpperCase(),
      delivery_zip: r.delivery_zip?.trim() || null,
      delivery_contact_name: r.delivery_contact_name?.trim() || null,
      delivery_contact_phone: r.delivery_contact_phone?.trim() || null,
      delivery_date: r.delivery_date?.trim() || null,
      revenue: String(revenue),
      carrier_pay: String(carrierPay),
      broker_fee: String(brokerFee),
      payment_type: paymentType,
    })

    if (error) {
      result.errors.push({ row: i + 1, message: 'Failed to create order' })
    } else {
      result.created++
    }
  }

  revalidatePath('/orders')
  return result
}

export async function rollbackOrderStatus(id: string) {
  const auth = await authorize('orders.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch current order
  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !current) {
    return { error: 'Order not found' }
  }

  const currentStatus = current.status as OrderStatus

  if (currentStatus === 'new') {
    return { error: 'Cannot roll back further -- order is already at the initial status' }
  }

  if (currentStatus === 'cancelled') {
    return { error: 'Cancelled orders cannot be rolled back' }
  }

  const currentIndex = STATUS_ORDER.indexOf(currentStatus)
  if (currentIndex < 0) {
    return { error: 'Cannot determine previous status' }
  }

  const previousStatus = STATUS_ORDER[currentIndex - 1]

  // Build update payload, clearing relevant date fields
  const updateData: Record<string, unknown> = {
    status: previousStatus,
  }

  // If rolling back FROM picked_up, clear actual_pickup_date
  if (currentStatus === 'picked_up') {
    updateData.actual_pickup_date = null
  }

  // If rolling back FROM delivered, clear actual_delivery_date
  if (currentStatus === 'delivered') {
    updateData.actual_delivery_date = null
  }

  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'rollbackOrderStatus') }
  }

  revalidatePath(`/orders/${id}`)
  revalidatePath('/orders')
  return { success: true, data: order }
}
