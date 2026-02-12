'use server'

import { createClient } from '@/lib/supabase/server'
import { tripSchema } from '@/lib/validations/trip'
import { revalidatePath } from 'next/cache'
import { calculateTripFinancials } from '@/lib/financial/trip-calculations'
import type { TripStatus } from '@/types'

// Trip status → Order status auto-sync mapping
const TRIP_TO_ORDER_STATUS: Partial<Record<TripStatus, string>> = {
  in_progress: 'picked_up',
  completed: 'delivered',
  planned: 'assigned',
}

export async function createTrip(data: unknown) {
  const parsed = tripSchema.safeParse(data)
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

  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      tenant_id: tenantId,
      driver_id: v.driver_id,
      truck_id: v.truck_id,
      start_date: v.start_date,
      end_date: v.end_date,
      carrier_pay: String(v.carrier_pay),
      notes: v.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dispatch')
  return { success: true, tripId: trip.id }
}

export async function updateTrip(id: string, data: unknown) {
  const parsed = tripSchema.partial().safeParse(data)
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
  if (v.driver_id !== undefined) updateData.driver_id = v.driver_id
  if (v.truck_id !== undefined) updateData.truck_id = v.truck_id
  if (v.start_date !== undefined) updateData.start_date = v.start_date
  if (v.end_date !== undefined) updateData.end_date = v.end_date
  if (v.carrier_pay !== undefined) updateData.carrier_pay = String(v.carrier_pay)
  if (v.notes !== undefined) updateData.notes = v.notes || null

  const { data: trip, error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // If carrier_pay changed, recalculate financials
  if (v.carrier_pay !== undefined) {
    await recalculateTripFinancials(id)
  }

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${id}`)
  return { success: true, data: trip }
}

export async function deleteTrip(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Unassign all orders from this trip before deleting
  const { error: unassignError } = await supabase
    .from('orders')
    .update({ trip_id: null, status: 'new' })
    .eq('trip_id', id)

  if (unassignError) {
    return { error: unassignError.message }
  }

  const { error } = await supabase.from('trips').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dispatch')
  revalidatePath('/orders')
  return { success: true }
}

export async function updateTripStatus(id: string, newStatus: TripStatus) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Update trip status
  const { data: trip, error } = await supabase
    .from('trips')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Auto-sync order statuses based on trip status change
  const orderStatus = TRIP_TO_ORDER_STATUS[newStatus]
  if (orderStatus) {
    const { error: syncError } = await supabase
      .from('orders')
      .update({ status: orderStatus })
      .eq('trip_id', id)

    if (syncError) {
      return { error: syncError.message }
    }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${id}`)
  revalidatePath('/orders')
  return { success: true, data: trip }
}

export async function assignOrderToTrip(orderId: string, tripId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get the order's current trip_id (old trip) before reassignment
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('trip_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !currentOrder) {
    return { error: fetchError?.message ?? 'Order not found' }
  }

  const oldTripId = currentOrder.trip_id

  // Update order: assign to new trip and set status to 'assigned'
  const { error: updateError } = await supabase
    .from('orders')
    .update({ trip_id: tripId, status: 'assigned' })
    .eq('id', orderId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Recalculate old trip financials if the order was previously assigned
  if (oldTripId && oldTripId !== tripId) {
    await recalculateTripFinancials(oldTripId)
  }

  // Recalculate new trip financials
  await recalculateTripFinancials(tripId)

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${tripId}`)
  if (oldTripId && oldTripId !== tripId) {
    revalidatePath(`/trips/${oldTripId}`)
  }
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return { success: true }
}

export async function unassignOrderFromTrip(orderId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Get the order's current trip_id
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('trip_id')
    .eq('id', orderId)
    .single()

  if (fetchError || !currentOrder) {
    return { error: fetchError?.message ?? 'Order not found' }
  }

  const oldTripId = currentOrder.trip_id

  if (!oldTripId) {
    return { error: 'Order is not assigned to any trip' }
  }

  // Update order: clear trip_id and reset status to 'new'
  const { error: updateError } = await supabase
    .from('orders')
    .update({ trip_id: null, status: 'new' })
    .eq('id', orderId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Recalculate old trip financials
  await recalculateTripFinancials(oldTripId)

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${oldTripId}`)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return { success: true }
}

export async function recalculateTripFinancials(tripId: string) {
  const supabase = await createClient()

  // Fetch trip with driver relation for pay calculation
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, driver:drivers(driver_type, pay_type, pay_rate)')
    .eq('id', tripId)
    .single()

  if (tripError || !trip) {
    return { error: tripError?.message ?? 'Trip not found' }
  }

  // Fetch trip's orders for revenue and route summary
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, pickup_state, delivery_state, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

  if (ordersError) {
    return { error: ordersError.message }
  }

  // Fetch trip's expenses
  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('amount')
    .eq('trip_id', tripId)

  if (expensesError) {
    return { error: expensesError.message }
  }

  // Parse numeric strings
  const parsedOrders = (orders ?? []).map((o) => ({
    revenue: parseFloat(o.revenue || '0'),
    brokerFee: parseFloat(o.broker_fee || '0'),
    pickup_state: o.pickup_state,
    delivery_state: o.delivery_state,
  }))

  const parsedExpenses = (expenses ?? []).map((e) => ({
    amount: parseFloat(e.amount || '0'),
  }))

  const carrierPay = parseFloat(trip.carrier_pay || '0')

  // Calculate financials using the shared calculation module
  const driver = trip.driver as {
    driver_type: string
    pay_type: string
    pay_rate: number
  } | null

  const driverConfig = driver
    ? {
        driverType: driver.driver_type as import('@/types').DriverType,
        payType: driver.pay_type as import('@/types').DriverPayType,
        payRate: driver.pay_rate,
      }
    : null

  const financials = calculateTripFinancials(parsedOrders, driverConfig, parsedExpenses, carrierPay)

  // Compute route summary from orders
  let originSummary: string | null = null
  let destinationSummary: string | null = null

  if (parsedOrders.length > 0) {
    // Collect unique pickup states (preserve order for first/last logic)
    const pickupStates: string[] = []
    for (const o of parsedOrders) {
      if (o.pickup_state && !pickupStates.includes(o.pickup_state)) {
        pickupStates.push(o.pickup_state)
      }
    }
    originSummary = pickupStates.length > 0 ? pickupStates.join(', ') : null

    // Collect unique delivery states
    const deliveryStates: string[] = []
    for (const o of parsedOrders) {
      if (o.delivery_state && !deliveryStates.includes(o.delivery_state)) {
        deliveryStates.push(o.delivery_state)
      }
    }
    destinationSummary = deliveryStates.length > 0 ? deliveryStates.join(', ') : null
  }

  // Update trip with denormalized financial values and route summary
  const { error: updateError } = await supabase
    .from('trips')
    .update({
      total_revenue: String(financials.revenue),
      total_broker_fees: String(financials.brokerFees),
      driver_pay: String(financials.driverPay),
      total_expenses: String(financials.expenses),
      net_profit: String(financials.netProfit),
      order_count: parsedOrders.length,
      origin_summary: originSummary,
      destination_summary: destinationSummary,
    })
    .eq('id', tripId)

  if (updateError) {
    return { error: updateError.message }
  }

  return { success: true }
}
