import { renderToBuffer } from '@react-pdf/renderer'
import { authorize } from '@/lib/authz'
import { getResend, sendEmailWithTimeout } from '@/lib/resend/client'
import { getSignedUrl } from '@/lib/storage'
import { logOrderActivity } from '@/lib/activity-log'
import { ReceiptDocument } from '@/lib/pdf/receipt-template'
import { ReceiptEmail } from '@/components/email/receipt-email'
import { captureAsyncError } from '@/lib/async-safe'
import { sendReceiptSchema } from '@/lib/validations/receipt'

/**
 * Send a payment receipt PDF for a non-BILL order.
 *
 * Recipient options: pickup contact, delivery contact, or broker.
 * Caller supplies the email to use (prefilled from order data if on file,
 * otherwise operator-entered in the dialog). BILL-type orders are handled
 * by the invoice send flow at `/api/invoices/[orderId]/send` and are
 * rejected here with HTTP 409.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params

  // Gate behind receipts.send. Match invoice send rate-limit profile (10/min)
  // so the two email flows share the same abuse ceiling.
  const auth = await authorize('receipts.send', {
    rateLimit: { key: 'receiptSend', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) {
    const status = auth.error === 'Not authenticated' ? 401 : 403
    return Response.json({ error: auth.error }, { status })
  }
  const { supabase, tenantId, user } = auth.ctx

  // Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = sendReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const { recipient, email } = parsed.data

  // Fetch order (tenant-scoped) with broker join for the receipt header
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      '*, broker:brokers(id, name, email)',
    )
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (orderError || !order) {
    return Response.json({ error: 'Order not found' }, { status: 404 })
  }

  // Defense-in-depth: BILL orders use the invoice flow, not the receipt flow.
  if (order.payment_type === 'BILL') {
    return Response.json(
      { error: 'BILL orders use the Send Invoice flow. Use that instead.' },
      { status: 409 },
    )
  }

  // Fetch most recent payment event (payments table is the source of truth
  // for payment date; order.amount_paid is the denormalized total).
  const { data: latestPayment } = await supabase
    .from('payments')
    .select('payment_date')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)
    .order('payment_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // If no payment rows exist yet, fall back to today — the operator has
  // opted in to sending the receipt now. updated_at is NOT used as a
  // fallback because an unrelated order edit after payment would make it
  // misrepresent the real payment timing.
  const paymentDate: string =
    (latestPayment?.payment_date as string | undefined) ??
    new Date().toISOString()

  // Resolve recipient label for the PDF header ("Receipt For: …")
  const recipientLabel = (() => {
    if (recipient === 'pickup') {
      return `Pickup contact${
        order.pickup_contact_name ? `: ${order.pickup_contact_name}` : ''
      }`
    }
    if (recipient === 'delivery') {
      return `Delivery contact${
        order.delivery_contact_name ? `: ${order.delivery_contact_name}` : ''
      }`
    }
    return `Broker${order.broker?.name ? `: ${order.broker.name}` : ''}`
  })()

  // Tenant branding / company block
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('name, address, city, state, zip, phone, dot_number, mc_number, logo_storage_path')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    return Response.json(
      { error: 'Tenant information not found' },
      { status: 500 },
    )
  }

  let logoUrl: string | null = null
  if (tenant.logo_storage_path) {
    const { url } = await getSignedUrl(
      supabase,
      'branding',
      tenant.logo_storage_path,
      1800,
    )
    logoUrl = url || null
  }

  // Render PDF
  let pdfBuffer: Buffer
  try {
    const buffer = await renderToBuffer(
      ReceiptDocument({
        order,
        tenant,
        recipientLabel,
        paymentDate,
        logoUrl,
      }),
    )
    pdfBuffer = Buffer.from(buffer)
  } catch (err) {
    console.error('Receipt PDF generation failed:', err)
    return Response.json(
      { error: 'Failed to generate receipt PDF' },
      { status: 500 },
    )
  }

  const rawReceiptNumber = order.order_number
    ? `RCPT-${order.order_number}`
    : `RCPT-${(order.id as string).slice(0, 8).toUpperCase()}`
  // Sanitize for Content-Disposition header safety: strip CR/LF, quotes, and
  // non-ASCII. order_number is tenant-controlled free text and this value
  // flows into the attachment filename, which Resend passes straight into
  // the multipart header.
  const receiptNumber = rawReceiptNumber.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  let sendResult: Awaited<ReturnType<typeof sendEmailWithTimeout>>
  try {
    sendResult = await sendEmailWithTimeout(() =>
      getResend().emails.send({
        from: `${tenant.name} <${fromEmail}>`,
        to: [email],
        subject: `Payment Receipt ${receiptNumber}`,
        react: ReceiptEmail({
          order,
          tenant,
          paymentDate,
        }),
        attachments: [
          {
            filename: `${receiptNumber}.pdf`,
            content: pdfBuffer,
          },
        ],
      }),
    )
  } catch (err) {
    // Defense-in-depth: sendEmailWithTimeout should resolve with
    // { error } rather than throw, but a synchronous throw from the Resend
    // SDK (e.g. auth error) would otherwise surface as a generic Next 500.
    console.error('Receipt send failed:', err)
    return Response.json(
      { error: 'Failed to send receipt email' },
      { status: 500 },
    )
  }

  const { data, error: emailError } = sendResult
  if (emailError) {
    console.error('Resend receipt email error:', emailError)
    return Response.json(
      { error: 'Failed to send receipt email' },
      { status: 500 },
    )
  }

  // Fire-and-forget activity log (non-blocking)
  logOrderActivity(supabase, {
    tenantId,
    orderId,
    action: 'receipt_sent',
    description: `Payment receipt sent to ${email} (${recipient})`,
    actorId: user.id,
    actorEmail: user.email,
  }).catch(captureAsyncError('receipt send'))

  return Response.json({ success: true, emailId: data?.id })
}
