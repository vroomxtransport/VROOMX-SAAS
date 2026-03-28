import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { corsHeaders } from '@/lib/extension/cors'
import { authenticateExtension } from '@/lib/extension/auth'
import { rateLimit } from '@/lib/rate-limit'
import { createOrderSchema } from '@/lib/validations/order'
import { safeError } from '@/lib/authz'

const confirmSchema = z.array(createOrderSchema)

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request)

  // Authenticate via bearer token
  const auth = await authenticateExtension(request)
  if (!auth) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401, headers: cors }
    )
  }

  // Rate limit: 10 requests per minute per user
  const rl = await rateLimit(`${auth.userId}:extensionConfirm`, {
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: cors }
    )
  }

  try {
    const body: unknown = await request.json()

    // Validate order array with Zod
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order data. Please review and correct the extracted orders.' },
        { status: 400, headers: cors }
      )
    }

    const { supabase, tenantId } = auth
    const created: string[] = []
    const errors: string[] = []

    for (const order of parsed.data) {
      const firstVehicle = order.vehicles?.[0]
      const { error } = await supabase.from('orders').insert({
        tenant_id: tenantId,
        vehicle_vin: firstVehicle?.vin || null,
        vehicle_year: firstVehicle?.year,
        vehicle_make: firstVehicle?.make || '',
        vehicle_model: firstVehicle?.model || '',
        vehicle_type: firstVehicle?.type || null,
        vehicle_color: firstVehicle?.color || null,
        vehicles: order.vehicles,
        pickup_location: order.pickupLocation,
        pickup_city: order.pickupCity,
        pickup_state: order.pickupState,
        pickup_zip: order.pickupZip || null,
        pickup_contact_name: order.pickupContactName || null,
        pickup_contact_phone: order.pickupContactPhone || null,
        pickup_date: order.pickupDate || null,
        delivery_location: order.deliveryLocation,
        delivery_city: order.deliveryCity,
        delivery_state: order.deliveryState,
        delivery_zip: order.deliveryZip || null,
        delivery_contact_name: order.deliveryContactName || null,
        delivery_contact_phone: order.deliveryContactPhone || null,
        delivery_date: order.deliveryDate || null,
        revenue: String(order.revenue),
        carrier_pay: String(order.carrierPay),
        broker_fee: String(order.brokerFee),
        local_fee: String(order.localFee ?? 0),
        distance_miles: order.distanceMiles ? String(order.distanceMiles) : null,
        payment_type: order.paymentType,
        broker_id: order.brokerId || null,
        driver_id: order.driverId || null,
        status: 'new',
        notes: 'Imported via Chrome Extension',
      })

      const label = firstVehicle
        ? `${firstVehicle.year} ${firstVehicle.make} ${firstVehicle.model}`
        : 'Unknown vehicle'

      if (error) {
        errors.push(`${label}: Failed to create order`)
      } else {
        created.push(label)
      }
    }

    return NextResponse.json(
      { created, errors },
      { status: 200, headers: cors }
    )
  } catch (err) {
    safeError(err as { message: string }, 'extension:confirm')
    return NextResponse.json(
      { error: 'Failed to create orders. Please try again.' },
      { status: 500, headers: cors }
    )
  }
}
