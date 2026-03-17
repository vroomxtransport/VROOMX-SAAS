import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return Response.json({ error: 'No tenant found' }, { status: 403 })
  }

  // Fetch order with broker relation
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, carrier_pay, vehicle_vin, vehicle_year, vehicle_make, vehicle_model, pickup_city, pickup_state, delivery_city, delivery_state, payment_type, cod_amount, billing_amount, broker:brokers(id, name, email)')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fetch tenant for company info
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, address, city, state, zip, phone')
    .single()

  if (tenantError || !tenant) {
    return Response.json(
      { error: 'Tenant information not found' },
      { status: 500 }
    )
  }

  // Normalize broker relation (Supabase may return array)
  const brokerRaw = order.broker as unknown as { name: string; email: string | null } | { name: string; email: string | null }[] | null
  const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw

  try {
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({ order: { ...order, broker }, tenant })
    )

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="INV-${orderId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return Response.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
