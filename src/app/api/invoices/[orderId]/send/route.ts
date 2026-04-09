import { renderToBuffer } from '@react-pdf/renderer'
import { authorize } from '@/lib/authz'
import { getResend } from '@/lib/resend/client'
import { getSignedUrl } from '@/lib/storage'
import { logOrderActivity } from '@/lib/activity-log'
import { syncInvoiceToQB } from '@/lib/quickbooks/sync'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'
import { InvoiceEmail } from '@/components/email/invoice-email'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params

  // SCAN-002 (SEC-003): gate behind invoices.send permission. This route
  // previously only verified authentication + tenant presence, letting any
  // tenant member email invoices regardless of role. Rate-limit modest to
  // cap email abuse (Resend-backed).
  const auth = await authorize('invoices.send', {
    rateLimit: { key: 'invoiceSend', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) {
    const status = auth.error === 'Not authenticated' ? 401 : 403
    return Response.json({ error: auth.error }, { status })
  }
  const { supabase, tenantId, user } = auth.ctx

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

  // Validate broker has email
  if (!order.broker || !order.broker.email) {
    return Response.json(
      { error: 'Broker email is required to send an invoice' },
      { status: 400 }
    )
  }

  // Fetch tenant for company info (include branding fields)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, address, city, state, zip, phone, logo_storage_path, invoice_header_text, invoice_footer_text')
    .single()

  if (tenantError || !tenant) {
    return Response.json(
      { error: 'Tenant information not found' },
      { status: 500 }
    )
  }

  // Resolve logo signed URL if one is stored (valid for 30 min — long enough for PDF gen + email send)
  let logoUrl: string | null = null
  if (tenant.logo_storage_path) {
    const { url } = await getSignedUrl(supabase, 'branding', tenant.logo_storage_path, 1800)
    logoUrl = url || null
  }

  // Generate PDF buffer
  let pdfBuffer: Buffer
  try {
    const buffer = await renderToBuffer(
      InvoiceDocument({ order, tenant, logoUrl })
    )
    pdfBuffer = Buffer.from(buffer)
  } catch (err) {
    console.error('PDF generation failed:', err)
    return Response.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    )
  }

  // Compute invoice number
  const invoiceNumber = `INV-${orderId}`

  // Send email via Resend
  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

    const { data, error: emailError } = await getResend().emails.send({
      from: `${tenant.name} <${fromEmail}>`,
      to: [order.broker.email],
      subject: `Invoice ${invoiceNumber}`,
      react: InvoiceEmail({ order, tenant }),
      attachments: [
        {
          filename: `${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (emailError) {
      console.error('Resend email error:', emailError)
      return Response.json(
        { error: 'Failed to send invoice email' },
        { status: 500 }
      )
    }

    // Update order status on successful email send
    const updateFields: Record<string, string> = {}

    // Set payment_status to 'invoiced' only if currently 'unpaid'
    if (order.payment_status === 'unpaid') {
      updateFields.payment_status = 'invoiced'
    }

    // Set invoice_date only if not already set (don't overwrite on re-send)
    if (!order.invoice_date) {
      updateFields.invoice_date = new Date().toISOString()
    }

    // Advance order status to 'invoiced' only if currently 'delivered'
    if (order.status === 'delivered') {
      updateFields.status = 'invoiced'
    }

    let didAdvanceToInvoiced = false

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateFields)
        .eq('id', orderId)
        .eq('tenant_id', tenantId)

      if (updateError) {
        console.error('Failed to update order status:', updateError)
        // Email was sent successfully, so still return success
        // but log the status update failure
      } else {
        didAdvanceToInvoiced = updateFields.status === 'invoiced'
      }
    }

    // Fire-and-forget: sync invoice to QuickBooks
    void syncInvoiceToQB(supabase, tenantId, orderId).catch(() => {})

    // Fire-and-forget activity log
    logOrderActivity(supabase, {
      tenantId,
      orderId,
      action: 'invoice_sent',
      description: `Invoice sent to ${order.broker.email}`,
      actorId: user.id,
      actorEmail: user.email,
    }).catch(() => {})

    return Response.json({ success: true, emailId: data?.id })
  } catch (err) {
    console.error('Invoice send failed:', err)
    return Response.json(
      { error: 'Failed to send invoice email' },
      { status: 500 }
    )
  }
}
