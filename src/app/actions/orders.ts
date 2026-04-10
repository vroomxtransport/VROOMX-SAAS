'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { createOrderSchema } from '@/lib/validations/order'
import { geocodeAndSaveOrder } from '@/lib/geocoding-helpers'
import { logOrderActivity } from '@/lib/activity-log'
import { recalculateTripFinancials } from '@/app/actions/trips'
import { uploadFile, deleteFile } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { dispatchWebhookEvent } from '@/lib/webhooks/webhook-dispatcher'
import { sanitizePayload } from '@/lib/webhooks/payload-sanitizer'
import { computeOrderDriverPay, type DriverLike } from '@/lib/financial/driver-pay'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderStatus } from '@/types'

const ATTACHMENT_BUCKET = 'attachments'

// Max time createOrder / updateOrder will wait for the Mapbox geocoding +
// distance calculation before returning. Typical Mapbox calls complete in
// ~1-2 seconds; this budget gives us margin for one retry while still
// keeping the worst-case server-action latency reasonable. If the budget
// expires the geocoding promise keeps running in the background and the
// realtime subscription will pick up the eventual DB update.
const GEOCODE_AWAIT_BUDGET_MS = 6_000

const uuidSchema = z.string().uuid()

// Status workflow: defines the linear progression of order statuses
const STATUS_ORDER: OrderStatus[] = ['new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid']

const VALID_STATUSES: OrderStatus[] = ['new', 'assigned', 'picked_up', 'delivered', 'invoiced', 'paid', 'cancelled']

/**
 * Compute the per-order driver pay from the currently-stored row and the
 * assigned driver's config, then UPDATE the `carrier_pay` column with the
 * result. Used by createOrder and updateOrder after the initial insert /
 * update + geocoding pass so the column reflects `driver pay for this
 * order`, locked at the time of the write.
 *
 * Returns the freshly-fetched row (after the carrier_pay update). If no
 * driver is assigned, writes 0 and returns the row.
 */
async function applyComputedDriverPay(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  row: {
    driver_id: string | null
    revenue: string
    broker_fee: string
    local_fee: string
    distance_miles: string | null
    driver_pay_rate_override: string | null
    vehicles: unknown
  }
): Promise<Record<string, unknown>> {
  // Fetch driver config if one is assigned.
  let driverConfig: DriverLike | null = null
  if (row.driver_id) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('pay_type, pay_rate')
      .eq('id', row.driver_id)
      .eq('tenant_id', tenantId)
      .single()
    if (driver && driver.pay_type && driver.pay_rate != null) {
      driverConfig = {
        payType: driver.pay_type,
        payRate: parseFloat(driver.pay_rate),
      }
    }
  }

  // Build the OrderLike shape the calculator expects.
  const vehicleCount = Array.isArray(row.vehicles) ? row.vehicles.length : 1
  const driverPay = computeOrderDriverPay(driverConfig, {
    revenue: parseFloat(row.revenue),
    brokerFee: parseFloat(row.broker_fee),
    localFee: parseFloat(row.local_fee),
    distanceMiles: row.distance_miles ? parseFloat(row.distance_miles) : null,
    driverPayRateOverride: row.driver_pay_rate_override ? parseFloat(row.driver_pay_rate_override) : null,
    vehicleCount,
  })

  // Store the rounded computed value (2 decimal places matches the
  // numeric(12,2) column precision).
  const rounded = Math.round(driverPay * 100) / 100
  await supabase
    .from('orders')
    .update({ carrier_pay: String(rounded) })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  // Re-fetch so the returned object has the final carrier_pay value.
  const { data: refreshed } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()
  return (refreshed ?? row) as Record<string, unknown>
}

export async function createOrder(data: unknown) {
  const parsed = createOrderSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const auth = await authorize('orders.create', { rateLimit: { key: 'createOrder', limit: 30, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Extract first vehicle for flat columns (backward compat + search)
  const firstVehicle = v.vehicles[0]

  // Map camelCase form fields to snake_case DB columns
  // Do NOT set order_number -- the DB trigger generates it atomically
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      // Flat vehicle columns from first vehicle (for search + backward compat)
      vehicle_vin: firstVehicle.vin || null,
      vehicle_year: firstVehicle.year,
      vehicle_make: firstVehicle.make,
      vehicle_model: firstVehicle.model,
      vehicle_type: firstVehicle.type || null,
      vehicle_color: firstVehicle.color || null,
      // Full vehicles array
      vehicles: v.vehicles,
      pickup_location: v.pickupLocation,
      pickup_city: v.pickupCity,
      pickup_state: v.pickupState,
      pickup_zip: v.pickupZip || null,
      pickup_contact_name: v.pickupContactName || null,
      pickup_contact_phone: v.pickupContactPhone || null,
      pickup_date: v.pickupDate || null,
      pickup_customer_type: v.pickupCustomerType || null,
      delivery_customer_type: v.deliveryCustomerType || null,
      delivery_location: v.deliveryLocation,
      delivery_city: v.deliveryCity,
      delivery_state: v.deliveryState,
      delivery_zip: v.deliveryZip || null,
      delivery_contact_name: v.deliveryContactName || null,
      delivery_contact_phone: v.deliveryContactPhone || null,
      delivery_date: v.deliveryDate || null,
      revenue: String(v.revenue),
      // carrier_pay is computed server-side after insert + geocoding below
      // (see applyComputedDriverPay). Initial placeholder of '0' is written
      // here and overwritten once we know the final distance and driver.
      carrier_pay: '0',
      broker_fee: String(v.brokerFee),
      local_fee: String(v.localFee),
      driver_pay_rate_override: v.driverPayRateOverride ? String(v.driverPayRateOverride) : null,
      payment_type: v.paymentType,
      cod_amount: v.paymentType === 'SPLIT' && v.codAmount != null ? String(v.codAmount) : null,
      // SPLIT payments divide the broker's revenue into a COD portion
      // (collected at pickup/delivery) and a billing portion (invoiced
      // later): billing = revenue - cod. Unrelated to driver pay.
      billing_amount: v.paymentType === 'SPLIT' && v.codAmount != null ? String(v.revenue - v.codAmount) : null,
      broker_id: v.brokerId || null,
      driver_id: v.driverId || null,
      distance_miles: v.distanceMiles ? String(v.distanceMiles) : null,
      dispatched_by: auth.ctx.user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: safeError(error, 'createOrder') }
  }

  // Geocoding: await briefly so the response includes coordinates +
  // distance_miles. Previously this was pure fire-and-forget, which
  // forced the user to reload the page to see the calculated distance
  // and RPM values. We bound the wait at GEOCODE_AWAIT_BUDGET_MS to
  // protect against Mapbox slowdowns — if the budget expires the
  // geocoding promise keeps running in the background and the realtime
  // subscription will pick up the eventual DB update.
  const geocodePromise = geocodeAndSaveOrder(supabase, order.id, tenantId, {
    pickupLocation: v.pickupLocation,
    pickupCity: v.pickupCity,
    pickupState: v.pickupState,
    pickupZip: v.pickupZip,
    deliveryLocation: v.deliveryLocation,
    deliveryCity: v.deliveryCity,
    deliveryState: v.deliveryState,
    deliveryZip: v.deliveryZip,
  }).catch((err) => console.error('[geocoding] createOrder failed:', err))

  await Promise.race([
    geocodePromise,
    new Promise<void>((resolve) => setTimeout(resolve, GEOCODE_AWAIT_BUDGET_MS)),
  ])

  // Re-fetch the row to pick up coordinates + distance_miles written by
  // the geocoding pass. If the budget expired first, this returns the
  // original row state and realtime will catch the eventual update.
  const { data: refreshed } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order.id)
    .eq('tenant_id', tenantId)
    .single()
  const rowAfterGeocode = refreshed ?? order

  // Compute and store driver pay now that distance_miles is populated.
  // This guarantees that when the user sees the order for the first time,
  // the Driver Pay value is already locked in (not "—" awaiting recalc).
  const finalOrder = await applyComputedDriverPay(supabase, tenantId, order.id, rowAfterGeocode)

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId: order.id,
    action: 'order_created',
    description: 'Order created',
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
  }).catch(() => {})

  dispatchWebhookEvent(tenantId, 'order.created', sanitizePayload({
    id: order.id, order_number: order.order_number, status: order.status,
    broker_id: order.broker_id, revenue: order.revenue, broker_fee: order.broker_fee,
  })).catch(() => {})

  // Auto-create local drives if pickup/delivery states match a terminal
  void autoCreateLocalDrives(supabase, tenantId, finalOrder as Parameters<typeof autoCreateLocalDrives>[2]).catch(() => {})

  revalidatePath('/orders')
  return { success: true, data: finalOrder }
}

/**
 * Auto-create local drives (both directions) when an order's pickup or delivery
 * state matches an active terminal's auto_create_states configuration.
 * Fire-and-forget — errors are logged but don't block order creation.
 */
async function autoCreateLocalDrives(
  supabase: SupabaseClient,
  tenantId: string,
  order: {
    id: string
    pickup_location: string | null; pickup_city: string | null; pickup_state: string | null
    delivery_location: string | null; delivery_city: string | null; delivery_state: string | null
  }
) {
  if (!order.pickup_state && !order.delivery_state) return

  // Fetch active terminals with auto-create enabled
  const { data: terminals } = await supabase
    .from('terminals')
    .select('id, name, address, city, state, auto_create_states')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('auto_create_local_drives', true)

  if (!terminals || terminals.length === 0) return

  type TerminalRow = { id: string; name: string; address: string | null; city: string | null; state: string | null; auto_create_states: string[] | null }

  const findMatchingTerminal = (stateCode: string | null) => {
    if (!stateCode) return null
    return (terminals as TerminalRow[]).find((t) => {
      const states = t.auto_create_states
      if (!states || states.length === 0) return true
      return states.includes(stateCode)
    }) ?? null
  }

  // Check existing drives to avoid duplicates
  const { data: existingDrives } = await supabase
    .from('local_drives')
    .select('type')
    .eq('tenant_id', tenantId)
    .eq('order_id', order.id)

  const existingTypes = new Set((existingDrives ?? []).map((d: { type: string }) => d.type))

  const drivesToInsert: Record<string, unknown>[] = []

  // Pickup direction: order pickup → terminal
  if (order.pickup_state && !existingTypes.has('pickup_to_terminal')) {
    const terminal = findMatchingTerminal(order.pickup_state)
    if (terminal) {
      drivesToInsert.push({
        tenant_id: tenantId,
        order_id: order.id,
        terminal_id: terminal.id,
        type: 'pickup_to_terminal',
        status: 'pending',
        pickup_location: order.pickup_location,
        pickup_city: order.pickup_city,
        pickup_state: order.pickup_state,
        delivery_location: terminal.address || terminal.name,
        delivery_city: terminal.city,
        delivery_state: terminal.state,
        inspection_visibility: 'internal',
        notes: `Auto-created pickup to ${terminal.name}`,
      })
    }
  }

  // Delivery direction: terminal → order delivery
  if (order.delivery_state && !existingTypes.has('delivery_from_terminal')) {
    const terminal = findMatchingTerminal(order.delivery_state)
    if (terminal) {
      drivesToInsert.push({
        tenant_id: tenantId,
        order_id: order.id,
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
        notes: `Auto-created delivery from ${terminal.name}`,
      })
    }
  }

  if (drivesToInsert.length > 0) {
    await supabase.from('local_drives').insert(drivesToInsert)
  }
}

export async function updateOrder(id: string, data: unknown) {
  const parsed = createOrderSchema.partial().safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Rate-limit updates to bound Mapbox cost. Each address-touching update
  // can fire up to 3 Mapbox calls (geocode pickup + geocode delivery +
  // directions), so without a cap an authenticated user could exhaust the
  // tenant's free tier in minutes via scripted edits.
  const auth = await authorize('orders.update', { rateLimit: { key: 'updateOrder', limit: 60, windowMs: 60_000 } })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const v = parsed.data

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  // Multi-vehicle support: sync flat columns from first vehicle
  if (v.vehicles !== undefined && v.vehicles.length > 0) {
    const first = v.vehicles[0]
    updateData.vehicles = v.vehicles
    updateData.vehicle_vin = first.vin || null
    updateData.vehicle_year = first.year
    updateData.vehicle_make = first.make
    updateData.vehicle_model = first.model
    updateData.vehicle_type = first.type || null
    updateData.vehicle_color = first.color || null
  }
  if (v.pickupLocation !== undefined) updateData.pickup_location = v.pickupLocation
  if (v.pickupCity !== undefined) updateData.pickup_city = v.pickupCity
  if (v.pickupState !== undefined) updateData.pickup_state = v.pickupState
  if (v.pickupZip !== undefined) updateData.pickup_zip = v.pickupZip || null
  if (v.pickupContactName !== undefined) updateData.pickup_contact_name = v.pickupContactName || null
  if (v.pickupContactPhone !== undefined) updateData.pickup_contact_phone = v.pickupContactPhone || null
  if (v.pickupDate !== undefined) updateData.pickup_date = v.pickupDate || null
  if (v.pickupCustomerType !== undefined) updateData.pickup_customer_type = v.pickupCustomerType || null
  if (v.deliveryCustomerType !== undefined) updateData.delivery_customer_type = v.deliveryCustomerType || null
  if (v.deliveryLocation !== undefined) updateData.delivery_location = v.deliveryLocation
  if (v.deliveryCity !== undefined) updateData.delivery_city = v.deliveryCity
  if (v.deliveryState !== undefined) updateData.delivery_state = v.deliveryState
  if (v.deliveryZip !== undefined) updateData.delivery_zip = v.deliveryZip || null
  if (v.deliveryContactName !== undefined) updateData.delivery_contact_name = v.deliveryContactName || null
  if (v.deliveryContactPhone !== undefined) updateData.delivery_contact_phone = v.deliveryContactPhone || null
  if (v.deliveryDate !== undefined) updateData.delivery_date = v.deliveryDate || null
  if (v.revenue !== undefined) updateData.revenue = String(v.revenue)
  // carrier_pay is not accepted from the form — it's recomputed below
  // from the driver config after the main update completes.
  if (v.brokerFee !== undefined) updateData.broker_fee = String(v.brokerFee)
  if (v.localFee !== undefined) updateData.local_fee = String(v.localFee)
  if (v.driverPayRateOverride !== undefined) updateData.driver_pay_rate_override = v.driverPayRateOverride ? String(v.driverPayRateOverride) : null
  if (v.paymentType !== undefined) updateData.payment_type = v.paymentType
  // Split payment: billing_amount = revenue - cod_amount. Revenue may come
  // from the current update or the existing stored value; if neither is
  // present we can't recompute the billing amount and leave it as-is.
  const effectivePaymentType = v.paymentType ?? updateData.payment_type
  const effectiveRevenue = v.revenue ?? (updateData.revenue ? parseFloat(updateData.revenue as string) : undefined)
  if (effectivePaymentType === 'SPLIT' && v.codAmount != null && effectiveRevenue != null) {
    updateData.cod_amount = String(v.codAmount)
    updateData.billing_amount = String(effectiveRevenue - v.codAmount)
  } else if (v.paymentType !== undefined && v.paymentType !== 'SPLIT') {
    updateData.cod_amount = null
    updateData.billing_amount = null
  }
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

  // Re-geocode if address fields changed. Awaited (with budget) so the
  // updated row that we return downstream already includes the new
  // coordinates + distance — same UX rationale as createOrder.
  let rowAfterGeocode: typeof order = order
  if (pickupAddressChanged || deliveryAddressChanged) {
    const geocodePromise = geocodeAndSaveOrder(supabase, id, tenantId, {
      pickupLocation: order.pickup_location,
      pickupCity: order.pickup_city,
      pickupState: order.pickup_state,
      pickupZip: order.pickup_zip,
      deliveryLocation: order.delivery_location,
      deliveryCity: order.delivery_city,
      deliveryState: order.delivery_state,
      deliveryZip: order.delivery_zip,
    }).catch((err) => console.error('[geocoding] updateOrder failed:', err))

    await Promise.race([
      geocodePromise,
      new Promise<void>((resolve) => setTimeout(resolve, GEOCODE_AWAIT_BUDGET_MS)),
    ])

    const { data: refreshed } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (refreshed) rowAfterGeocode = refreshed
  }

  // Recompute driver pay whenever an input to the formula changed. Inputs
  // are: driver_id, revenue, broker_fee, local_fee, distance_miles (via
  // geocoding), vehicles, driver_pay_rate_override. Cheaper to just always
  // recompute here — the formula is pure and deterministic.
  const driverPayInputs = ['driver_id', 'revenue', 'broker_fee', 'local_fee', 'driver_pay_rate_override', 'vehicles']
  const distanceChangedByGeocoding = rowAfterGeocode.distance_miles !== order.distance_miles
  const needsDriverPayRecompute =
    Object.keys(updateData).some((k) => driverPayInputs.includes(k)) || distanceChangedByGeocoding
  const finalOrder = needsDriverPayRecompute
    ? await applyComputedDriverPay(supabase, tenantId, id, rowAfterGeocode)
    : rowAfterGeocode

  // Recalculate trip financials if order is assigned and either financial
  // fields changed (including the newly computed carrier_pay), driver
  // changed, or geocoding wrote a new distance_miles.
  const financialFields = ['revenue', 'carrier_pay', 'broker_fee', 'local_fee', 'driver_pay_rate_override', 'distance_miles', 'driver_id']
  const hasFinancialChange = Object.keys(updateData).some(k => financialFields.includes(k))
  if (finalOrder.trip_id && (hasFinancialChange || distanceChangedByGeocoding || needsDriverPayRecompute)) {
    void recalculateTripFinancials(finalOrder.trip_id).catch(() => {})
  }

  // Fire-and-forget activity log
  const changedFields = Object.keys(updateData)
  logOrderActivity(supabase, {
    tenantId,
    orderId: id,
    action: 'order_updated',
    description: 'Order details updated',
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { changedFields },
  }).catch(() => {})

  dispatchWebhookEvent(tenantId, 'order.updated', sanitizePayload({
    id, ...Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k !== 'id')),
  })).catch(() => {})

  revalidatePath('/orders')
  return { success: true, data: finalOrder }
}

export async function deleteOrder(id: string) {
  const auth = await authorize('orders.delete')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  // Capture trip_id before delete for financial recalculation
  const { data: existing } = await supabase
    .from('orders')
    .select('trip_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const tripId = existing?.trip_id

  // Log activity BEFORE delete (the order row will be cascade-deleted)
  logOrderActivity(supabase, {
    tenantId,
    orderId: id,
    action: 'order_deleted',
    description: 'Order deleted',
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
  }).catch(() => {})

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: safeError(error, 'deleteOrder') }
  }

  // Recalculate trip financials if order was assigned to a trip
  if (tripId) {
    void recalculateTripFinancials(tripId).catch(() => {})
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

  // Fetch current status for activity log
  const { data: current } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  const oldStatus = current?.status ?? 'unknown'

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

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId: id,
    action: 'status_changed',
    description: `Status changed from ${oldStatus} to ${newStatus}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { oldStatus, newStatus },
  }).catch(() => {})

  dispatchWebhookEvent(tenantId, 'order.status_changed', sanitizePayload({
    id, status: newStatus, previous_status: oldStatus,
  })).catch(() => {})

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
  broker_fee?: string | number
  payment_type?: string
  cod_amount?: string | number
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
    const brokerFee = r.broker_fee ? Number(r.broker_fee) : 0

    if (isNaN(revenue) || isNaN(brokerFee)) {
      result.errors.push({ row: i + 1, message: 'Invalid numeric value for revenue or broker_fee' })
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
      // carrier_pay is computed from driver config; imports start at 0
      // and can be updated later when a driver is assigned via updateOrder.
      carrier_pay: '0',
      broker_fee: String(brokerFee),
      payment_type: paymentType,
      ...(paymentType === 'SPLIT' && r.cod_amount ? {
        cod_amount: String(parseFloat(String(r.cod_amount))),
        // SPLIT: billing = revenue - cod (unrelated to driver pay)
        billing_amount: String(revenue - parseFloat(String(r.cod_amount))),
      } : {}),
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

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId: id,
    action: 'status_rolled_back',
    description: `Status rolled back from ${currentStatus} to ${previousStatus}`,
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
    metadata: { oldStatus: currentStatus, newStatus: previousStatus },
  }).catch(() => {})

  revalidatePath(`/orders/${id}`)
  revalidatePath('/orders')
  return { success: true, data: order }
}

// ----------------------------------------------------------------------------
// Order attachments (SCAN-005 / SEC-010)
// ----------------------------------------------------------------------------
// These server actions replace direct client-side Supabase writes in
// src/app/(dashboard)/orders/_components/order-attachments.tsx. Both enforce
// orders.update so viewer-only roles cannot upload or delete attachments,
// which the client-side path did not gate (RLS checked tenant_id only).

export async function uploadOrderAttachment(formData: FormData) {
  const orderIdRaw = formData.get('orderId')
  const file = formData.get('file')

  const orderIdParsed = uuidSchema.safeParse(orderIdRaw)
  if (!orderIdParsed.success) {
    return { error: 'Invalid order id' }
  }
  if (!(file instanceof File)) {
    return { error: 'Missing file' }
  }

  const orderId = orderIdParsed.data

  const auth = await authorize('orders.update', {
    rateLimit: { key: 'uploadOrderAttachment', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Verify the order belongs to the caller's tenant before attaching.
  // This prevents a user from attaching files to another tenant's order
  // via a forged orderId even if RLS on order_attachments had a gap.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (orderErr) return { error: safeError(orderErr, 'uploadOrderAttachment.order') }
  if (!order) return { error: 'Order not found' }

  const { path, error: uploadErr } = await uploadFile(
    supabase,
    ATTACHMENT_BUCKET,
    tenantId,
    orderId,
    file,
  )
  if (uploadErr || !path) {
    return { error: uploadErr ?? 'Upload failed' }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('order_attachments')
    .insert({
      tenant_id: tenantId,
      order_id: orderId,
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      storage_path: path,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select('id, file_name, storage_path')
    .single()

  if (insertErr || !inserted) {
    // Clean up the uploaded object so we don't leak storage on failure.
    await deleteFile(supabase, ATTACHMENT_BUCKET, path).catch(() => {})
    return { error: safeError(insertErr ?? { message: 'insert failed' }, 'uploadOrderAttachment.insert') }
  }

  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'attachment_uploaded',
    description: `Attachment uploaded: ${file.name}`,
    actorId: user.id,
    actorEmail: user.email,
  }).catch(() => {})

  revalidatePath(`/orders/${orderId}`)
  return { success: true, data: inserted }
}

export async function deleteOrderAttachment(attachmentId: string) {
  const parsed = uuidSchema.safeParse(attachmentId)
  if (!parsed.success) return { error: 'Invalid attachment id' }

  const auth = await authorize('orders.update', {
    rateLimit: { key: 'deleteOrderAttachment', limit: 60, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId, user } = auth.ctx

  // Fetch tenant-scoped row to get storage_path + order_id for revalidation.
  // Tenant filter here is load-bearing: it's our authorization check on the
  // attachment itself, independent of RLS.
  const { data: attachment, error: fetchErr } = await supabase
    .from('order_attachments')
    .select('id, order_id, file_name, storage_path')
    .eq('id', parsed.data)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (fetchErr) return { error: safeError(fetchErr, 'deleteOrderAttachment.fetch') }
  if (!attachment) return { error: 'Attachment not found' }

  // Delete storage object first. If the storage delete fails we still try
  // the DB delete — an orphaned storage object is less bad than a dangling
  // DB row pointing to a deleted file.
  await deleteFile(supabase, ATTACHMENT_BUCKET, attachment.storage_path).catch(() => {})

  const { error: deleteErr } = await supabase
    .from('order_attachments')
    .delete()
    .eq('id', parsed.data)
    .eq('tenant_id', tenantId)

  if (deleteErr) return { error: safeError(deleteErr, 'deleteOrderAttachment.delete') }

  logOrderActivity(supabase, {
    tenantId,
    orderId: attachment.order_id,
    action: 'attachment_deleted',
    description: `Attachment deleted: ${attachment.file_name}`,
    actorId: user.id,
    actorEmail: user.email,
  }).catch(() => {})

  revalidatePath(`/orders/${attachment.order_id}`)
  return { success: true }
}
