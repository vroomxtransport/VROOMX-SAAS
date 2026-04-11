'use server'

import { authorize, safeError } from '@/lib/authz'
import { tripSchema } from '@/lib/validations/trip'
import { logOrderActivity } from '@/lib/activity-log'
import { logAuditEvent } from '@/lib/audit-log'
import { getAuditContext } from '@/lib/audit-context'
import { revalidatePath } from 'next/cache'
import { dispatchWebhookEvent } from '@/lib/webhooks/webhook-dispatcher'
import { sanitizePayload } from '@/lib/webhooks/payload-sanitizer'
import { calculateTripFinancials } from '@/lib/financial/trip-calculations'
import { z } from 'zod'
import type { OrderStatus, TripStatus } from '@/types'
import type { RouteStop } from '@/types/database'

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

  const auditCtx = await getAuditContext()

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

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'trip',
    entityId: trip.id,
    action: 'created',
    description: `Trip ${trip.trip_number} created`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { driverId: v.driver_id, truckId: v.truck_id },
    changeDiff: { before: {}, after: trip },
    ...auditCtx,
  }).catch(() => {})

  dispatchWebhookEvent(tenantId, 'trip.created', sanitizePayload({
    id: trip.id, trip_number: trip.trip_number, status: trip.status,
    driver_id: trip.driver_id, truck_id: trip.truck_id,
  })).catch(() => {})

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

  // CodeAuditX #3 BUG-2 (pre-existing, surfaced by the CAS refactor):
  // `tripSchema` has `carrier_pay: z.coerce.number()...default(0)`. Because
  // Zod's `.partial()` does NOT strip `.default()`, every updateTrip() call
  // that omits `carrier_pay` still ends up with `v.carrier_pay === 0` after
  // parsing — which previously (a) overwrote the DB's `carrier_pay` with 0
  // on every notes-only update (silent data corruption) and (b) triggered a
  // full recalc on every call (wasted round trips). Check the RAW input
  // before it went through Zod's default to detect whether carrier_pay was
  // actually provided by the caller.
  const carrierPayProvided =
    data !== null &&
    typeof data === 'object' &&
    'carrier_pay' in (data as Record<string, unknown>)

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (v.driver_id !== undefined) updateData.driver_id = v.driver_id
  if (v.truck_id !== undefined) updateData.truck_id = v.truck_id
  if (v.start_date !== undefined) updateData.start_date = v.start_date
  if (v.end_date !== undefined) updateData.end_date = v.end_date
  if (carrierPayProvided && v.carrier_pay !== undefined) {
    updateData.carrier_pay = String(v.carrier_pay)
  }
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

  // If carrier_pay was actually provided, recalculate financials.
  // CodeAuditX #3 BUG-2: surface CAS-exhaustion errors to the client
  // instead of silently returning success with stale totals.
  if (carrierPayProvided) {
    const recalc = await recalculateTripFinancials(id)
    if ('error' in recalc && recalc.error) {
      return { error: recalc.error }
    }
  }

  dispatchWebhookEvent(tenantId, 'trip.updated', sanitizePayload({
    id: trip.id, trip_number: trip.trip_number,
  })).catch(() => {})

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

  const auditCtx = await getAuditContext()

  // Fetch current status before update for audit trail
  const { data: currentTrip } = await supabase
    .from('trips')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const previousStatus = currentTrip?.status ?? 'unknown'
  const orderStatus = TRIP_TO_ORDER_STATUS[newStatus]

  let syncedOrders: Array<{ id: string; status: string }> = []
  if (orderStatus) {
    const { data: tripOrders, error: tripOrdersError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('trip_id', id)
      .eq('tenant_id', tenantId)

    if (tripOrdersError) {
      return { error: safeError(tripOrdersError, 'updateTripStatus.fetchOrdersForSync') }
    }

    syncedOrders = (tripOrders ?? [])
      .filter((order) => order.status !== orderStatus)
      .map((order) => ({
        id: order.id,
        status: order.status,
      }))
  }

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

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'trip',
    entityId: id,
    action: 'status_changed',
    description: `Trip ${trip.trip_number} status changed from ${previousStatus} to ${newStatus}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { from: previousStatus, to: newStatus },
    changeDiff: { before: { status: previousStatus }, after: { status: newStatus } },
    ...auditCtx,
  }).catch(() => {})

  // Auto-sync order statuses based on trip status change
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

  // Dispatch webhook after order sync succeeds (not before — avoids stale events)
  dispatchWebhookEvent(tenantId, 'trip.status_changed', sanitizePayload({
    id, status: newStatus, previous_status: previousStatus,
  })).catch(() => {})

  // Auto-create pending local deliveries for qualifying orders
  if (newStatus === 'at_terminal') {
    // Fetch tenant's active terminals with auto_create enabled
    const { data: terminals } = await supabase
      .from('terminals')
      .select('id, name, address, city, state, auto_create_states')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('auto_create_local_drives', true)

    if (terminals && terminals.length > 0) {
      // Fetch all trip orders
      const { data: tripOrders } = await supabase
        .from('orders')
        .select('id, delivery_location, delivery_city, delivery_state, broker_fee')
        .eq('trip_id', id)
        .eq('tenant_id', tenantId)

      if (tripOrders && tripOrders.length > 0) {
        // Check existing local drives to prevent duplicates
        const orderIds = tripOrders.map((o) => o.id)
        const { data: existingDrives } = await supabase
          .from('local_drives')
          .select('order_id')
          .eq('tenant_id', tenantId)
          .in('order_id', orderIds)

        const existingOrderIds = new Set(existingDrives?.map((d) => d.order_id) ?? [])

        const newDrives: Array<Record<string, unknown>> = []

        for (const terminal of terminals) {
          const autoStates = terminal.auto_create_states as string[] | null

          const qualifying = tripOrders.filter((o) => {
            if (existingOrderIds.has(o.id)) return false
            // If terminal has auto_create_states, filter by delivery state
            if (autoStates && autoStates.length > 0) {
              return autoStates.includes(o.delivery_state ?? '')
            }
            // No state filter — all orders qualify
            return true
          })

          for (const order of qualifying) {
            newDrives.push({
              tenant_id: tenantId,
              order_id: order.id,
              trip_id: id,
              terminal_id: terminal.id,
              type: 'delivery_from_terminal',
              status: 'pending',
              pickup_location: terminal.address || terminal.name,
              pickup_city: terminal.city,
              pickup_state: terminal.state,
              delivery_location: order.delivery_location,
              delivery_city: order.delivery_city,
              delivery_state: order.delivery_state,
              inspection_visibility: 'internal',
              revenue: order.broker_fee,
              notes: `Auto-created from trip at-terminal via ${terminal.name}. Delivery to ${order.delivery_city}, ${order.delivery_state}`,
            })
            // Mark as handled to prevent duplicate across multiple terminals
            existingOrderIds.add(order.id)
          }
        }

        if (newDrives.length > 0) {
          const { error: driveError } = await supabase
            .from('local_drives')
            .insert(newDrives)

          if (driveError) {
            safeError(driveError, 'updateTripStatus.createLocalDrives')
          }

          revalidatePath('/local-drives')
        }
      }
    } else {
      // Fallback: no terminals configured — use legacy hardcoded behavior
      const LOCAL_DELIVERY_STATES = ['PA', 'NJ', 'NY']

      const { data: qualifyingOrders } = await supabase
        .from('orders')
        .select('id, delivery_location, delivery_city, delivery_state, broker_fee')
        .eq('trip_id', id)
        .eq('tenant_id', tenantId)
        .gt('broker_fee', '0')
        .in('delivery_state', LOCAL_DELIVERY_STATES)

      if (qualifyingOrders && qualifyingOrders.length > 0) {
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
            trip_id: id,
            type: 'delivery_from_terminal' as const,
            status: 'pending' as const,
            pickup_location: 'Terminal',
            delivery_location: order.delivery_location,
            delivery_city: order.delivery_city,
            delivery_state: order.delivery_state,
            inspection_visibility: 'internal',
            revenue: order.broker_fee,
            notes: `Auto-created from trip at-terminal. Delivery to ${order.delivery_city}, ${order.delivery_state}`,
          }))

        if (newDrives.length > 0) {
          const { error: driveError } = await supabase
            .from('local_drives')
            .insert(newDrives)

          if (driveError) {
            safeError(driveError, 'updateTripStatus.createLocalDrives')
          }

          revalidatePath('/local-drives')
        }
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

  const auditCtx = await getAuditContext()

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

  // Recalculate old trip financials if the order was previously assigned.
  // CodeAuditX #3 BUG-2: surface CAS-exhaustion errors.
  if (oldTripId && oldTripId !== tripId) {
    const recalcOld = await recalculateTripFinancials(oldTripId)
    if ('error' in recalcOld && recalcOld.error) {
      return { error: recalcOld.error }
    }
  }

  // Recalculate new trip financials
  const recalcNew = await recalculateTripFinancials(tripId)
  if ('error' in recalcNew && recalcNew.error) {
    return { error: recalcNew.error }
  }

  // Append new order stops to route_sequence
  const { data: tripData } = await supabase
    .from('trips')
    .select('route_sequence')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()

  const existingSequence: RouteStop[] = Array.isArray(tripData?.route_sequence)
    ? (tripData.route_sequence as RouteStop[])
    : []

  const newSequence: RouteStop[] = [
    ...existingSequence,
    { orderId, stopType: 'pickup' },
    { orderId, stopType: 'delivery' },
  ]

  await supabase
    .from('trips')
    .update({ route_sequence: newSequence })
    .eq('id', tripId)
    .eq('tenant_id', tenantId)

  // Fire-and-forget activity log
  const { data: tripInfo } = await supabase
    .from('trips')
    .select('trip_number')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()

  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'assigned_to_trip',
    description: `Assigned to trip ${tripInfo?.trip_number ?? tripId}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { tripId, tripNumber: tripInfo?.trip_number },
  }).catch(() => {})

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'trip',
    entityId: tripId,
    action: 'order_assigned',
    description: `Order assigned to trip ${tripInfo?.trip_number ?? tripId}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { orderId },
    changeDiff: { before: { trip_id: oldTripId ?? null }, after: { trip_id: tripId } },
    ...auditCtx,
  }).catch(() => {})

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

  const auditCtx = await getAuditContext()

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

  // Recalculate old trip financials.
  // CodeAuditX #3 BUG-2: surface CAS-exhaustion errors.
  const recalc = await recalculateTripFinancials(oldTripId)
  if ('error' in recalc && recalc.error) {
    return { error: recalc.error }
  }

  // Get trip info for activity log
  const { data: tripInfo } = await supabase
    .from('trips')
    .select('trip_number')
    .eq('id', oldTripId)
    .eq('tenant_id', tenantId)
    .single()

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'unassigned_from_trip',
    description: `Unassigned from trip ${tripInfo?.trip_number ?? oldTripId}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { tripId: oldTripId, tripNumber: tripInfo?.trip_number },
  }).catch(() => {})

  logAuditEvent(supabase, {
    tenantId,
    entityType: 'trip',
    entityId: oldTripId,
    action: 'order_unassigned',
    description: `Order unassigned from trip ${tripInfo?.trip_number ?? oldTripId}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { orderId },
    changeDiff: { before: { trip_id: oldTripId }, after: { trip_id: null } },
    ...auditCtx,
  }).catch(() => {})

  // Remove unassigned order's stops from route_sequence
  const { data: tripData } = await supabase
    .from('trips')
    .select('route_sequence')
    .eq('id', oldTripId)
    .eq('tenant_id', tenantId)
    .single()

  if (tripData?.route_sequence && Array.isArray(tripData.route_sequence)) {
    const filtered = (tripData.route_sequence as RouteStop[]).filter(
      (stop) => stop.orderId !== orderId
    )
    await supabase
      .from('trips')
      .update({ route_sequence: filtered.length > 0 ? filtered : null })
      .eq('id', oldTripId)
      .eq('tenant_id', tenantId)
  }

  revalidatePath('/dispatch')
  revalidatePath(`/trips/${oldTripId}`)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return { success: true }
}

/**
 * CodeAuditX Critical #3: optimistic concurrency control parameters.
 *
 * `recalculateTripFinancials` runs a non-atomic SELECT→compute→UPDATE cycle.
 * Because Supabase-JS speaks to PgBouncer in transaction-mode, each REST
 * call is its own Postgres transaction — there is no way to hold a row-level
 * lock across statements from outside a stored procedure. Pushing the
 * compute into PL/pgSQL would duplicate ~170 lines of well-tested TypeScript
 * financial logic, so instead we use a version column on the trips table
 * and a compare-and-swap (CAS) retry loop here.
 *
 * Contention in practice should be rare (two order edits hitting the same
 * trip at the same instant), so 5 retries with exponential backoff is
 * plenty — if we exhaust them something else is wrong and we return an
 * error rather than silently corrupt driver pay.
 */
const RECALC_MAX_ATTEMPTS = 5
const RECALC_BACKOFF_MS = [25, 50, 100, 200, 400] as const

export async function recalculateTripFinancials(tripId: string) {
  const auth = await authorize('trips.view', { checkSuspension: false })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  for (let attempt = 0; attempt < RECALC_MAX_ATTEMPTS; attempt++) {
    // -----------------------------------------------------------------------
    // READ PHASE — everything needed to recompute, including the current
    // version for the CAS. Re-read on every retry because another writer
    // may have mutated orders/expenses/local_drives between attempts.
    // -----------------------------------------------------------------------

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, version, carrier_pay, driver:drivers(driver_type, pay_type, pay_rate)')
      .eq('id', tripId)
      .eq('tenant_id', tenantId)
      .single()

    if (tripError || !trip) {
      return { error: 'Trip not found' }
    }

    const oldVersion = (trip as unknown as { version: number }).version

    // Fetch trip's orders for revenue and route summary.
    //
    // `carrier_pay` is included because it now holds the stored per-order
    // driver-pay value (see `applyComputedDriverPay` in
    // src/app/actions/orders.ts). The trip-level `driver_pay` is the SUM of
    // these stored values — historical accuracy — rather than a re-compute
    // from the driver's current rate.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('revenue, carrier_pay, broker_fee, local_fee, distance_miles, driver_pay_rate_override, vehicles, pickup_state, delivery_state, created_at')
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

    // Fetch local operations expense (sum of local_drives linked to this trip)
    const { data: localDrives } = await supabase
      .from('local_drives')
      .select('expense_amount')
      .eq('trip_id', tripId)
      .eq('tenant_id', tenantId)

    const localOpsExpense = (localDrives ?? []).reduce(
      (sum, d) => sum + parseFloat((d as { expense_amount: string }).expense_amount || '0'),
      0
    )

    // -----------------------------------------------------------------------
    // COMPUTE PHASE — pure TS, no DB calls, deterministic given the inputs
    // above. Kept in TypeScript rather than PL/pgSQL to avoid business-logic
    // drift with src/lib/financial/trip-calculations.ts.
    // -----------------------------------------------------------------------

    // Parse order data: financial fields + route fields
    const rawOrders = (orders ?? []).map((o) => ({
      revenue: parseFloat(o.revenue || '0'),
      driverPayStored: parseFloat(o.carrier_pay || '0'),
      brokerFee: parseFloat(o.broker_fee || '0'),
      localFee: parseFloat(o.local_fee || '0'),
      distanceMiles: o.distance_miles ? parseFloat(o.distance_miles) : null,
      driverPayRateOverride: o.driver_pay_rate_override ? parseFloat(o.driver_pay_rate_override) : null,
      vehicleCount: Array.isArray(o.vehicles) ? o.vehicles.length : 1,
      pickup_state: o.pickup_state as string | null,
      delivery_state: o.delivery_state as string | null,
    }))

    // Sum of stored per-order driver pay. This is the source of truth for
    // the trip-level driver_pay — locked at the time each order was
    // created or re-assigned, so historical driver-rate changes don't
    // retroactively alter past trip earnings.
    const storedDriverPaySum = rawOrders.reduce((sum, o) => sum + o.driverPayStored, 0)

    // OrderFinancials for calculateTripFinancials
    const orderFinancials = rawOrders.map((o) => ({
      revenue: o.revenue,
      brokerFee: o.brokerFee,
      localFee: o.localFee,
      distanceMiles: o.distanceMiles,
      driverPayRateOverride: o.driverPayRateOverride,
    }))

    const parsedExpenses = (expenses ?? []).map((e) => ({
      amount: parseFloat(e.amount || '0'),
    }))

    const carrierPay = parseFloat((trip as unknown as { carrier_pay: string }).carrier_pay || '0')

    // Build driver config from joined relation
    const driverRaw = (trip as unknown as { driver: {
      driver_type: string
      pay_type: string
      pay_rate: string
    } | null }).driver

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

    // Override the recomputed driver pay with the sum of stored per-order
    // values. `financials.netProfit` subtracted the recomputed amount, so
    // we adjust by the delta before also subtracting local ops expense.
    const driverPayDelta = storedDriverPaySum - financials.driverPay
    const adjustedNetProfit = financials.netProfit - driverPayDelta - localOpsExpense

    // -----------------------------------------------------------------------
    // WRITE PHASE — CAS on version. The third .eq('version', oldVersion)
    // makes this an atomic compare-and-swap at the Postgres level: if
    // another writer bumped version between our SELECT and this UPDATE,
    // zero rows match and we retry with fresh data.
    // -----------------------------------------------------------------------

    const { data: updated, error: updateError } = await supabase
      .from('trips')
      .update({
        total_revenue: String(financials.revenue),
        total_broker_fees: String(financials.brokerFees),
        total_local_fees: String(financials.localFees),
        driver_pay: String(storedDriverPaySum),
        total_expenses: String(financials.expenses),
        local_operations_expense: String(localOpsExpense),
        net_profit: String(adjustedNetProfit),
        order_count: rawOrders.length,
        total_miles: String(financials.totalMiles),
        origin_summary: originSummary,
        destination_summary: destinationSummary,
        version: oldVersion + 1,
      })
      .eq('id', tripId)
      .eq('tenant_id', tenantId)
      .eq('version', oldVersion)
      .select('id')

    if (updateError) {
      return { error: safeError(updateError, 'recalculateTripFinancials.update') }
    }

    if (updated && updated.length > 0) {
      // CAS succeeded — totals committed, version bumped.
      return { success: true }
    }

    // CAS conflict: another writer incremented version between our SELECT
    // and this UPDATE. Wait briefly with exponential backoff, then retry
    // the full read-compute-write cycle with fresh data.
    if (attempt < RECALC_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, RECALC_BACKOFF_MS[attempt]))
    }
  }

  // All retries exhausted. Something is deeply wrong (or the contention is
  // pathological). Return an error rather than silently leaving stale
  // totals — callers decide whether to surface or swallow.
  return {
    error: safeError(
      {
        message: `recalculateTripFinancials: CAS conflict persisted after ${RECALC_MAX_ATTEMPTS} attempts for trip ${tripId}`,
      },
      'recalculateTripFinancials.cas_exhausted'
    ),
  }
}

// ============================================================================
// Route Sequencing
// ============================================================================

const routeSequenceSchema = z.object({
  tripId: z.string().uuid(),
  sequence: z.array(z.object({
    orderId: z.string().uuid(),
    stopType: z.enum(['pickup', 'delivery']),
  })),
})

export async function updateRouteSequence(data: unknown) {
  const parsed = routeSequenceSchema.safeParse(data)
  if (!parsed.success) {
    return { error: 'Invalid route sequence data' }
  }

  const auth = await authorize('trips.update')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const { tripId, sequence } = parsed.data

  // Verify trip belongs to tenant
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()

  if (tripError || !trip) {
    return { error: 'Trip not found' }
  }

  // Verify all referenced orders belong to this trip + tenant
  const orderIds = [...new Set(sequence.map((s) => s.orderId))]
  if (orderIds.length > 0) {
    const { data: tripOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('trip_id', tripId)
      .eq('tenant_id', tenantId)
      .in('id', orderIds)

    if (ordersError) {
      return { error: safeError(ordersError, 'updateRouteSequence.verifyOrders') }
    }

    const validOrderIds = new Set((tripOrders ?? []).map((o) => o.id))
    const invalidIds = orderIds.filter((id) => !validOrderIds.has(id))
    if (invalidIds.length > 0) {
      return { error: 'Some orders do not belong to this trip' }
    }
  }

  // Validate each order has exactly 1 pickup and 1 delivery
  const stopCounts = new Map<string, { pickup: number; delivery: number }>()
  for (const stop of sequence) {
    const counts = stopCounts.get(stop.orderId) ?? { pickup: 0, delivery: 0 }
    counts[stop.stopType]++
    stopCounts.set(stop.orderId, counts)
  }
  for (const [, counts] of stopCounts) {
    if (counts.pickup !== 1 || counts.delivery !== 1) {
      return { error: 'Each order must have exactly 1 pickup and 1 delivery stop' }
    }
  }

  // Save sequence
  const { error: updateError } = await supabase
    .from('trips')
    .update({ route_sequence: sequence })
    .eq('id', tripId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: safeError(updateError, 'updateRouteSequence') }
  }

  revalidatePath(`/trips/${tripId}`)
  return { success: true }
}
