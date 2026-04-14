import { renderToBuffer } from '@react-pdf/renderer'
import { authorize } from '@/lib/authz'
import { getSignedUrl } from '@/lib/storage'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  // SCAN-002 (SEC-003): gate behind invoices.view permission — previously
  // the handler only verified authentication + tenant presence, letting any
  // tenant member bypass the role-based permission model enforced in the
  // equivalent server actions.
  const auth = await authorize('invoices.view')
  if (!auth.ok) {
    const status = auth.error === 'Not authenticated' ? 401 : 403
    return Response.json({ error: auth.error }, { status })
  }
  const { supabase, tenantId } = auth.ctx

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

  // Fetch tenant for company info (include branding fields)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, address, city, state, zip, phone, dot_number, mc_number, logo_storage_path, invoice_header_text, invoice_footer_text')
    .single()

  if (tenantError || !tenant) {
    return Response.json(
      { error: 'Tenant information not found' },
      { status: 500 }
    )
  }

  // Resolve logo signed URL if one is stored
  let logoUrl: string | null = null
  if (tenant.logo_storage_path) {
    const { url } = await getSignedUrl(supabase, 'branding', tenant.logo_storage_path, 3600)
    logoUrl = url || null
  }

  // Normalize broker relation (Supabase may return array)
  const brokerRaw = order.broker as unknown as { name: string; email: string | null } | { name: string; email: string | null }[] | null
  const broker = Array.isArray(brokerRaw) ? brokerRaw[0] ?? null : brokerRaw

  try {
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({ order: { ...order, broker }, tenant, logoUrl })
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
