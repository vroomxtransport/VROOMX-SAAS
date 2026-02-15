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
    .select('*, broker:brokers(id, name, email)')
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

  try {
    const pdfBuffer = await renderToBuffer(
      InvoiceDocument({ order, tenant })
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
