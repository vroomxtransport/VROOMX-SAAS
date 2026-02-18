'use server'

import { authorize, safeError } from '@/lib/authz'
import { extractOrdersFromPDF, type PDFExtractionResult } from '@/lib/ai/pdf-parser'
import { createOrderSchema } from '@/lib/validations/order'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export async function importOrdersFromPDF(
  formData: FormData
): Promise<{ success: true; data: PDFExtractionResult } | { error: string }> {
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return { error: 'No file uploaded' }
  }

  if (file.type !== 'application/pdf') {
    return { error: 'Only PDF files are accepted' }
  }

  if (file.size > 25 * 1024 * 1024) {
    return { error: 'File size must be under 25MB' }
  }

  const auth = await authorize('orders.create', {
    rateLimit: { key: 'importPdf', limit: 5, windowMs: 60_000 },
  })
  if (!auth.ok) return { error: auth.error }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const result = await extractOrdersFromPDF(base64)
    return { success: true, data: result }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'importOrdersFromPDF') }
  }
}

const confirmSchema = z.array(createOrderSchema)

export async function confirmPdfImport(orders: unknown) {
  const parsed = confirmSchema.safeParse(orders)
  if (!parsed.success) {
    return { error: 'Invalid order data. Please review and correct the extracted orders.' }
  }

  const auth = await authorize('orders.create')
  if (!auth.ok) return { error: auth.error }
  const { supabase, tenantId } = auth.ctx

  const created: string[] = []
  const errors: string[] = []

  for (const order of parsed.data) {
    const { error } = await supabase.from('orders').insert({
      tenant_id: tenantId,
      vehicle_vin: order.vehicleVin || null,
      vehicle_year: order.vehicleYear,
      vehicle_make: order.vehicleMake,
      vehicle_model: order.vehicleModel,
      vehicle_type: order.vehicleType || null,
      vehicle_color: order.vehicleColor || null,
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
    })

    if (error) {
      errors.push(`${order.vehicleYear} ${order.vehicleMake} ${order.vehicleModel}: ${error.message}`)
    } else {
      created.push(`${order.vehicleYear} ${order.vehicleMake} ${order.vehicleModel}`)
    }
  }

  revalidatePath('/orders')
  return { success: true, data: { created, errors } }
}
