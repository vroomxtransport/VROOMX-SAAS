import { geocodeAddress } from '@/lib/geocoding'
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

/**
 * Geocodes pickup + delivery addresses and writes coordinates back to the order.
 * Skips if city+state are missing or coordinates already exist.
 * Fire-and-forget — failures are logged but don't affect the caller.
 */
export async function geocodeAndSaveOrder(
  supabase: SupabaseClient,
  orderId: string,
  tenantId: string,
  fields: AddressFields
): Promise<void> {
  const updateData: Record<string, number | null> = {}

  // Geocode pickup
  if (fields.pickupCity && fields.pickupState) {
    const pickup = await geocodeAddress(
      fields.pickupLocation,
      fields.pickupCity,
      fields.pickupState,
      fields.pickupZip
    )
    if (pickup) {
      updateData.pickup_latitude = pickup.latitude
      updateData.pickup_longitude = pickup.longitude
    }
  }

  // Geocode delivery
  if (fields.deliveryCity && fields.deliveryState) {
    const delivery = await geocodeAddress(
      fields.deliveryLocation,
      fields.deliveryCity,
      fields.deliveryState,
      fields.deliveryZip
    )
    if (delivery) {
      updateData.delivery_latitude = delivery.latitude
      updateData.delivery_longitude = delivery.longitude
    }
  }

  if (Object.keys(updateData).length === 0) return

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error(`[geocoding] Failed to save coordinates for order ${orderId}:`, error)
  }
}
