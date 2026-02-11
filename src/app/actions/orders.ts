'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderSchema } from '@/lib/validations/order'
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

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

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
      payment_type: v.paymentType,
      broker_id: v.brokerId || null,
      driver_id: v.driverId || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/orders')
  return { data: order }
}

export async function updateOrder(id: string, data: unknown) {
  const parsed = createOrderSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

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
  if (v.paymentType !== undefined) updateData.payment_type = v.paymentType
  if (v.brokerId !== undefined) updateData.broker_id = v.brokerId || null
  if (v.driverId !== undefined) updateData.driver_id = v.driverId || null

  const { data: order, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/orders')
  return { data: order }
}

export async function deleteOrder(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase.from('orders').delete().eq('id', id)

  if (error) {
    return { error: error.message }
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

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

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
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/orders/${id}`)
  revalidatePath('/orders')
  return { data: order }
}

export async function rollbackOrderStatus(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Fetch current order
  const { data: current, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return { error: fetchError?.message ?? 'Order not found' }
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
    return { error: `Cannot determine previous status for: ${currentStatus}` }
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
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/orders/${id}`)
  revalidatePath('/orders')
  return { data: order }
}
