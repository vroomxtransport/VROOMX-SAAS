'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { revalidatePath } from 'next/cache'
import { geocodeAddress } from '@/lib/geocoding'
import { calculateDrivingDistance, type RouteGeometry } from '@/lib/distance'
import { geocodeAndSaveOrder } from '@/lib/geocoding-helpers'
import { logOrderActivity } from '@/lib/activity-log'
import { captureAsyncError } from '@/lib/async-safe'
import {
  previewOrderDistanceSchema,
  type PreviewOrderDistanceErrorCode,
} from '@/lib/validations/order-preview'

/**
 * Live mileage + RPM preview for the create-order form. Runs two Mapbox
 * forward geocodes + one Directions call WITHOUT writing to the DB.
 * Same permission as order creation so we don't leak geocoding to viewers
 * with `orders.view` only. Rate-limited per-user to cap Mapbox cost.
 */
export async function previewOrderDistance(input: unknown): Promise<
  | {
      success: true
      miles: number
      durationMinutes: number
      revenuePerMile: number | null
      pickupLatitude: number
      pickupLongitude: number
      deliveryLatitude: number
      deliveryLongitude: number
      geometry: RouteGeometry | null
    }
  | { error: string; code?: PreviewOrderDistanceErrorCode }
> {
  const parsed = previewOrderDistanceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }
  const v = parsed.data

  const auth = await authorize('orders.create', {
    rateLimit: { key: 'orderPreview', limit: 30, windowMs: 60_000 },
  })
  if (!auth.ok) {
    return { error: auth.error }
  }

  // No DB write beyond this point — purely computes the distance so the
  // user sees miles + RPM before saving the order.
  try {
    const [pickup, delivery] = await Promise.all([
      geocodeAddress(v.pickupLocation, v.pickupCity, v.pickupState, v.pickupZip),
      geocodeAddress(v.deliveryLocation, v.deliveryCity, v.deliveryState, v.deliveryZip),
    ])

    if (!pickup || !delivery) {
      const missing: string[] = []
      if (!pickup) missing.push(`${v.pickupCity}, ${v.pickupState}`)
      if (!delivery) missing.push(`${v.deliveryCity}, ${v.deliveryState}`)
      return {
        error: `Could not locate ${missing.join(' and ')}`,
        code: 'GEOCODE_MISS',
      }
    }

    const distance = await calculateDrivingDistance(
      pickup.latitude,
      pickup.longitude,
      delivery.latitude,
      delivery.longitude,
    )
    if (!distance) {
      return {
        error: 'No route found between pickup and delivery',
        code: 'ROUTE_FAILED',
      }
    }

    // Revenue per mile = Clean Gross per mile, matching the financial
    // model (src/lib/financial/trip-calculations.ts). Subtract broker +
    // local fees before dividing so the preview matches what the user
    // sees on the saved order detail.
    const cleanGross =
      (v.revenue ?? 0) - (v.brokerFee ?? 0) - (v.localFee ?? 0)
    const revenuePerMile =
      cleanGross > 0 && distance.miles > 0
        ? Math.round((cleanGross / distance.miles) * 100) / 100
        : null

    return {
      success: true,
      miles: distance.miles,
      durationMinutes: distance.durationMinutes,
      revenuePerMile,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      deliveryLatitude: delivery.latitude,
      deliveryLongitude: delivery.longitude,
      geometry: distance.geometry,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: safeError({ message }, 'previewOrderDistance') }
  }
}

const recalculateSchema = z.object({ orderId: z.string().uuid() })

/**
 * Re-run geocoding + distance for an existing order. Used by the
 * "Recalculate Distance" button on order detail when the initial
 * geocode failed, was skipped, or the user changed the addresses
 * outside of the form flow.
 */
export async function recalculateOrderDistance(
  input: unknown,
): Promise<
  | { success: true; status: 'ok' | 'failed' | 'skipped'; miles: number | null; error?: string | null }
  | { error: string }
> {
  const parsed = recalculateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  const auth = await authorize('orders.update', {
    rateLimit: { key: 'orderRecalc', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) {
    return { error: auth.error }
  }
  const { supabase, tenantId, user } = auth.ctx

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select(
      'id, pickup_location, pickup_city, pickup_state, pickup_zip, delivery_location, delivery_city, delivery_state, delivery_zip',
    )
    .eq('id', parsed.data.orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (fetchError || !order) {
    return { error: 'Order not found' }
  }

  try {
    const outcome = await geocodeAndSaveOrder(supabase, order.id, tenantId, {
      pickupLocation: order.pickup_location,
      pickupCity: order.pickup_city,
      pickupState: order.pickup_state,
      pickupZip: order.pickup_zip,
      deliveryLocation: order.delivery_location,
      deliveryCity: order.delivery_city,
      deliveryState: order.delivery_state,
      deliveryZip: order.delivery_zip,
    })

    // Log the manual retry so dispatchers can see who ran it and why
    // it ended up where it did. Fire-and-forget; do not block the UI.
    logOrderActivity(supabase, {
      tenantId,
      orderId: order.id,
      action: 'distance_recalculated',
      description:
        outcome.status === 'ok' && outcome.distanceMiles !== null
          ? `Distance recalculated: ${outcome.distanceMiles} mi`
          : `Distance recalculation ${outcome.status}${outcome.error ? `: ${outcome.error}` : ''}`,
      actorId: user.id,
      actorEmail: user.email,
    }).catch(captureAsyncError('recalculateOrderDistance'))

    revalidatePath(`/orders/${order.id}`)

    return {
      success: true,
      status: outcome.status,
      miles: outcome.distanceMiles,
      error: outcome.error,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: safeError({ message }, 'recalculateOrderDistance') }
  }
}
