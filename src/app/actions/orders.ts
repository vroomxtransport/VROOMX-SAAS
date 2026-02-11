'use server'

import { createClient } from '@/lib/supabase/server'
import { createOrderSchema } from '@/lib/validations/order'
import { revalidatePath } from 'next/cache'

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
