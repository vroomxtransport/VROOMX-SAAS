import { geocodeAddress } from '@/lib/geocoding'
import { calculateDrivingDistance, type RouteGeometry } from '@/lib/distance'
import type { SupabaseClient } from '@supabase/supabase-js'

interface AddressFields {
  pickupLocation?: string | null
  pickupCity?: string | null
  pickupState?: string | null
  pickupZip?: string | null
  deliveryLocation?: string | null
  deliveryCity?: string | null
  deliveryState?: string | null
  deliveryZip?: string | null
}

export type GeocodeStatus = 'ok' | 'failed' | 'skipped'

export interface GeocodeOutcome {
  status: GeocodeStatus
  error: string | null
  distanceMiles: number | null
  pickupLatitude: number | null
  pickupLongitude: number | null
  deliveryLatitude: number | null
  deliveryLongitude: number | null
  routeGeometry: RouteGeometry | null
}

/**
 * Geocode pickup + delivery addresses, calculate driving distance, and
 * persist `{ coordinates, distance_miles, geocode_status, geocode_error,
 * route_geometry }` back onto the order. Returns the outcome so callers
 * can surface success / error state without a follow-up SELECT.
 *
 * Earlier revisions were pure fire-and-forget and silently swallowed
 * geocoding misses, Mapbox 4xx responses, and missing-city cases. Users
 * then saw blank mileage and RPM with no indication why. This version
 * writes one of three status values on every outcome so the UI can
 * render a "Calculating…" → "OK" / "Failed: …" / "Skipped: …" badge
 * and offer a Recalculate Distance button.
 *
 * Policy: if a user has manually typed a distance on the order, we do
 * NOT overwrite it, but we still record the outcome so the badge
 * reflects reality for the coordinates + geometry.
 */
export async function geocodeAndSaveOrder(
  supabase: SupabaseClient,
  orderId: string,
  tenantId: string,
  fields: AddressFields,
): Promise<GeocodeOutcome> {
  const outcome: GeocodeOutcome = {
    status: 'skipped',
    error: null,
    distanceMiles: null,
    pickupLatitude: null,
    pickupLongitude: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    routeGeometry: null,
  }

  const pickupReady = Boolean(fields.pickupCity && fields.pickupState)
  const deliveryReady = Boolean(fields.deliveryCity && fields.deliveryState)

  // Early skip — record why so the UI can prompt for the missing field.
  if (!pickupReady || !deliveryReady) {
    outcome.status = 'skipped'
    outcome.error = !pickupReady && !deliveryReady
      ? 'Missing city + state on both pickup and delivery'
      : !pickupReady
        ? 'Missing pickup city or state'
        : 'Missing delivery city or state'
    await persistOutcome(supabase, orderId, tenantId, outcome)
    return outcome
  }

  // Geocode pickup
  let pickupErr: string | null = null
  const pickup = await geocodeAddress(
    fields.pickupLocation,
    fields.pickupCity,
    fields.pickupState,
    fields.pickupZip,
  )
  if (pickup) {
    outcome.pickupLatitude = pickup.latitude
    outcome.pickupLongitude = pickup.longitude
  } else {
    pickupErr = `Could not locate pickup address: ${fields.pickupCity}, ${fields.pickupState}`
  }

  // Geocode delivery
  let deliveryErr: string | null = null
  const delivery = await geocodeAddress(
    fields.deliveryLocation,
    fields.deliveryCity,
    fields.deliveryState,
    fields.deliveryZip,
  )
  if (delivery) {
    outcome.deliveryLatitude = delivery.latitude
    outcome.deliveryLongitude = delivery.longitude
  } else {
    deliveryErr = `Could not locate delivery address: ${fields.deliveryCity}, ${fields.deliveryState}`
  }

  if (pickupErr || deliveryErr) {
    outcome.status = 'failed'
    outcome.error = [pickupErr, deliveryErr].filter(Boolean).join(' · ')
    await persistOutcome(supabase, orderId, tenantId, outcome)
    return outcome
  }

  // Calculate driving distance + capture route geometry for the map view.
  try {
    const distance = await calculateDrivingDistance(
      outcome.pickupLatitude!,
      outcome.pickupLongitude!,
      outcome.deliveryLatitude!,
      outcome.deliveryLongitude!,
    )
    if (!distance) {
      outcome.status = 'failed'
      outcome.error = 'Mapbox returned no route between pickup and delivery'
      await persistOutcome(supabase, orderId, tenantId, outcome)
      return outcome
    }
    outcome.distanceMiles = distance.miles
    outcome.routeGeometry = distance.geometry
    outcome.status = 'ok'
    outcome.error = null
  } catch (err) {
    outcome.status = 'failed'
    outcome.error = err instanceof Error ? err.message : 'Unknown routing error'
    console.error(`[geocoding] Distance calculation failed for order ${orderId}:`, err)
  }

  await persistOutcome(supabase, orderId, tenantId, outcome)
  return outcome
}

async function persistOutcome(
  supabase: SupabaseClient,
  orderId: string,
  tenantId: string,
  outcome: GeocodeOutcome,
): Promise<void> {
  // Check whether the order already has a manually entered distance; if
  // so, we preserve it. The calculated value still sits in `outcome` and
  // is returned to the caller in case they want to display it as a
  // suggestion, but the stored column stays user-controlled.
  const { data: existing } = await supabase
    .from('orders')
    .select('distance_miles')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  const hasManualDistance =
    existing?.distance_miles != null &&
    parseFloat(existing.distance_miles as string) > 0

  // Clip to a sane length before persisting so a pathological Mapbox
  // error (or a future proxy wrapper with a verbose body) can't bloat
  // the column or the activity-log row that references it.
  const safeError = outcome.error ? outcome.error.slice(0, 500) : null

  const updateData: Record<string, unknown> = {
    geocode_status: outcome.status,
    geocode_error: safeError,
  }

  if (outcome.pickupLatitude !== null && outcome.pickupLongitude !== null) {
    updateData.pickup_latitude = outcome.pickupLatitude
    updateData.pickup_longitude = outcome.pickupLongitude
  }
  if (outcome.deliveryLatitude !== null && outcome.deliveryLongitude !== null) {
    updateData.delivery_latitude = outcome.deliveryLatitude
    updateData.delivery_longitude = outcome.deliveryLongitude
  }
  if (outcome.routeGeometry) {
    updateData.route_geometry = outcome.routeGeometry
  }
  if (outcome.distanceMiles !== null && !hasManualDistance) {
    updateData.distance_miles = String(outcome.distanceMiles)
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error(`[geocoding] Failed to save outcome for order ${orderId}:`, error)
  }
}
