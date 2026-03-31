'use server'

import { authorize, safeError } from '@/lib/authz'
import { createOrderSchema } from '@/lib/validations/order'
import { geocodeAndSaveOrder } from '@/lib/geocoding-helpers'
import { logOrderActivity } from '@/lib/activity-log'
import { createWebNotification } from '@/app/actions/notifications'
import { recalculateTripFinancials } from '@/app/actions/trips'
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
      carrier_pay: String(v.carrierPay),
      broker_fee: String(v.brokerFee),
      local_fee: String(v.localFee),
      driver_pay_rate_override: v.driverPayRateOverride ? String(v.driverPayRateOverride) : null,
      payment_type: v.paymentType,
      cod_amount: v.paymentType === 'SPLIT' && v.codAmount != null ? String(v.codAmount) : null,
      billing_amount: v.paymentType === 'SPLIT' && v.codAmount != null ? String(v.carrierPay - v.codAmount) : null,
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

  // Fire-and-forget activity log
  logOrderActivity(supabase, {
    tenantId,
    orderId: order.id,
    action: 'order_created',
    description: 'Order created',
    actorId: auth.ctx.user.id,
    actorEmail: auth.ctx.user.email,
  }).catch(() => {})

  // Auto-create local drives if pickup/delivery states match a terminal
  void autoCreateLocalDrives(supabase, tenantId, order).catch(() => {})

  revalidatePath('/orders')
  return { success: true, data: order }
}

/**
 * Auto-create local drives (both directions) when an order's pickup or delivery
 * state matches an active terminal's auto_create_states configuration.
 * Fire-and-forget — errors are logged but don't block order creation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function autoCreateLocalDrives(
  supabase: any,
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

  const auth = await authorize('orders.update')
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
  if (v.carrierPay !== undefined) updateData.carrier_pay = String(v.carrierPay)
  if (v.brokerFee !== undefined) updateData.broker_fee = String(v.brokerFee)
  if (v.localFee !== undefined) updateData.local_fee = String(v.localFee)
  if (v.driverPayRateOverride !== undefined) updateData.driver_pay_rate_override = v.driverPayRateOverride ? String(v.driverPayRateOverride) : null
  if (v.paymentType !== undefined) updateData.payment_type = v.paymentType
  // Split payment: auto-calculate billing_amount from carrier_pay - cod_amount
  const effectivePaymentType = v.paymentType ?? updateData.payment_type
  const effectiveCarrierPay = v.carrierPay ?? (updateData.carrier_pay ? parseFloat(updateData.carrier_pay as string) : undefined)
  if (effectivePaymentType === 'SPLIT' && v.codAmount != null && effectiveCarrierPay != null) {
    updateData.cod_amount = String(v.codAmount)
    updateData.billing_amount = String(effectiveCarrierPay - v.codAmount)
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

  // Recalculate trip financials if order is assigned and financial fields changed
  const financialFields = ['revenue', 'carrier_pay', 'broker_fee', 'local_fee', 'driver_pay_rate_override', 'distance_miles']
  const hasFinancialChange = Object.keys(updateData).some(k => financialFields.includes(k))
  if (order.trip_id && hasFinancialChange) {
    void recalculateTripFinancials(order.trip_id).catch(() => {})
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

  revalidatePath('/orders')
  return { success: true, data: order }
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

  // Fire-and-forget notification
  void createWebNotification({
    userId: auth.ctx.user.id,
    type: 'order_status',
    title: `Order ${order.order_number} → ${newStatus}`,
    body: `Order status changed to ${newStatus}`,
    link: `/orders/${id}`,
  }).catch(() => {})

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
      ...(paymentType === 'SPLIT' && r.cod_amount ? {
        cod_amount: String(parseFloat(String(r.cod_amount))),
        billing_amount: String(carrierPay - parseFloat(String(r.cod_amount))),
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
