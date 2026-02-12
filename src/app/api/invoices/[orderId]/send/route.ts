import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'
import { InvoiceDocument } from '@/lib/pdf/invoice-template'
import { InvoiceEmail } from '@/components/email/invoice-email'

export async function POST(
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

  // Fetch order with broker relation
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, broker:brokers(id, name, email)')
    .eq('id', orderId)
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

  // Generate PDF buffer
  let pdfBuffer: Buffer
  try {
    const buffer = await renderToBuffer(
      InvoiceDocument({ order, tenant })
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

    const { data, error: emailError } = await resend.emails.send({
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

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateFields)
        .eq('id', orderId)

      if (updateError) {
        console.error('Failed to update order status:', updateError)
        // Email was sent successfully, so still return success
        // but log the status update failure
      }
    }

    return Response.json({ success: true, emailId: data?.id })
  } catch (err) {
    console.error('Invoice send failed:', err)
    return Response.json(
      { error: 'Failed to send invoice email' },
      { status: 500 }
    )
  }
}
