'use server'

import { authorize, safeError } from '@/lib/authz'
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

const VALID_TRIP_STATUSES: TripStatus[] = ['planned', 'in_progress', 'at_terminal', 'completed']

export async function createTrip(data: unknown) {
  const parsed = tripSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trips.create', { rateLimit: { key: 'createTrip', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    return { error: safeError(error, 'createTrip') }
  }

  revalidatePath('/dispatch')
  return { success: true, data: trip }
}

export async function updateTrip(id: string, data: unknown) {
  const parsed = tripSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('trips.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

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
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTrip') }
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
  const auth = await authorize('trips.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Unassign all orders from this trip before deleting
  const { error: unassignError } = await supabase
    .from('orders')
    .update({ trip_id: null, status: 'new' })
    .eq('trip_id', id)
    .eq('tenant_id', tenantId)

  if (unassignError) {
    return { error: safeError(unassignError, 'deleteTrip.unassign') }
  }

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteTrip') }
  }

  revalidatePath('/dispatch')
  revalidatePath('/orders')
  return { success: true }
}

export async function updateTripStatus(id: string, newStatus: TripStatus) {
  // Runtime validation of status
  if (!VALID_TRIP_STATUSES.includes(newStatus)) {
    return { error: 'Invalid trip status' }
  }

  const auth = await authorize('trips.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Update trip status
  const { data: trip, error } = await supabase
    .from('trips')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'updateTripStatus') }
  }

  // Auto-sync order statuses based on trip status change
  const orderStatus = TRIP_TO_ORDER_STATUS[newStatus]
  if (orderStatus) {
    const { error: syncError } = await supabase
      .from('orders')
      .update({ status: orderStatus })
      .eq('trip_id', id)
      .eq('tenant_id', tenantId)

    if (syncError) {
      return { error: safeError(syncError, 'updateTripStatus.syncOrders') }
    }
  }

  // Auto-create pending local deliveries for qualifying orders
  // Criteria: broker_fee > 0 AND delivery_state in PA, NJ, NY
  if (newStatus === 'at_terminal') {
    const LOCAL_DELIVERY_STATES = ['PA', 'NJ', 'NY']

    const { data: qualifyingOrders } = await supabase
      .from('orders')
      .select('id, delivery_location, delivery_city, delivery_state, broker_fee')
      .eq('trip_id', id)
      .eq('tenant_id', tenantId)
      .gt('broker_fee', '0')
      .in('delivery_state', LOCAL_DELIVERY_STATES)

    if (qualifyingOrders && qualifyingOrders.length > 0) {
      // Prevent duplicates — check which orders already have a local drive
      const orderIds = qualifyingOrders.map((o) => o.id)
      const { data: existingDrives } = await supabase
        .from('local_drives')
        .select('order_id')
        .eq('tenant_id', tenantId)
        .in('order_id', orderIds)

      const existingOrderIds = new Set(existingDrives?.map((d) => d.order_id) ?? [])

      const newDrives = qualifyingOrders
        .filter((o) => !existingOrderIds.has(o.id))
        .map((order) => ({
          tenant_id: tenantId,
          order_id: order.id,
          status: 'pending' as const,
          pickup_location: 'Terminal',
          delivery_location: order.delivery_location,
          delivery_city: order.delivery_city,
          delivery_state: order.delivery_state,
          revenue: order.broker_fee,
          notes: `Auto-created from trip at-terminal. Delivery to ${order.delivery_city}, ${order.delivery_state}`,
        }))

      if (newDrives.length > 0) {
        const { error: driveError } = await supabase
          .from('local_drives')
          .insert(newDrives)

        if (driveError) {
          // Log but don't fail the trip status update
          safeError(driveError, 'updateTripStatus.createLocalDrives')
        }

        revalidatePath('/local-drives')
      }
    }
  }

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${id}`)
  revalidatePath('/orders')
  return { success: true, data: trip }
}

export async function assignOrderToTrip(orderId: string, tripId: string) {
  const auth = await authorize('trips.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Get the order's current trip_id (old trip) before reassignment
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('trip_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !currentOrder) {
    return { error: 'Order not found' }
  }

  const oldTripId = currentOrder.trip_id

  // Update order: assign to new trip and set status to 'assigned'
  const { error: updateError } = await supabase
    .from('orders')
    .update({ trip_id: tripId, status: 'assigned' })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'assignOrderToTrip') }
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
  const auth = await authorize('trips.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Get the order's current trip_id
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('trip_id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !currentOrder) {
    return { error: 'Order not found' }
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
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'unassignOrderFromTrip') }
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
  const auth = await authorize('trips.view', { checkSuspension: false })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Fetch trip with driver relation for pay calculation
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, driver:drivers(driver_type, pay_type, pay_rate)')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()

  if (tripError || !trip) {
    return { error: 'Trip not found' }
  }

  // Fetch trip's orders for revenue and route summary
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('revenue, broker_fee, pickup_state, delivery_state, created_at')
    .eq('trip_id', tripId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (ordersError) {
    return { error: safeError(ordersError, 'recalculateTripFinancials.orders') }
  }

  // Fetch trip's expenses
  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('amount')
    .eq('trip_id', tripId)
    .eq('tenant_id', tenantId)

  if (expensesError) {
    return { error: safeError(expensesError, 'recalculateTripFinancials.expenses') }
  }

  // Parse order data: financial fields + route fields
  const rawOrders = (orders ?? []).map((o) => ({
    revenue: parseFloat(o.revenue || '0'),
    brokerFee: parseFloat(o.broker_fee || '0'),
    pickup_state: o.pickup_state as string | null,
    delivery_state: o.delivery_state as string | null,
  }))

  // OrderFinancials for calculateTripFinancials (only revenue + brokerFee)
  const orderFinancials = rawOrders.map((o) => ({
    revenue: o.revenue,
    brokerFee: o.brokerFee,
  }))

  const parsedExpenses = (expenses ?? []).map((e) => ({
    amount: parseFloat(e.amount || '0'),
  }))

  const carrierPay = parseFloat(trip.carrier_pay || '0')

  // Build driver config from joined relation
  const driverRaw = trip.driver as {
    driver_type: string
    pay_type: string
    pay_rate: string
  } | null

  const driverConfig = driverRaw
    ? {
        driverType: driverRaw.driver_type as import('@/types').DriverType,
        payType: driverRaw.pay_type as import('@/types').DriverPayType,
        payRate: parseFloat(driverRaw.pay_rate || '0'),
      }
    : null

  // Calculate financials using the shared calculation module (4 positional args)
  const financials = calculateTripFinancials(
    orderFinancials,
    driverConfig,
    parsedExpenses,
    carrierPay
  )

  // Compute route summary from orders
  let originSummary: string | null = null
  let destinationSummary: string | null = null

  if (rawOrders.length > 0) {
    // Collect unique pickup states (preserve insertion order)
    const pickupStates: string[] = []
    for (const o of rawOrders) {
      if (o.pickup_state && !pickupStates.includes(o.pickup_state)) {
        pickupStates.push(o.pickup_state)
      }
    }
    originSummary = pickupStates.length > 0 ? pickupStates.join(', ') : null

    // Collect unique delivery states
    const deliveryStates: string[] = []
    for (const o of rawOrders) {
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
      order_count: rawOrders.length,
      origin_summary: originSummary,
      destination_summary: destinationSummary,
    })
    .eq('id', tripId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'recalculateTripFinancials.update') }
  }

  return { success: true }
}
