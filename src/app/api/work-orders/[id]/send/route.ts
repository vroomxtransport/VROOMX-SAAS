import { renderToBuffer } from '@react-pdf/renderer'
import { authorize } from '@/lib/authz'
import { getResend, sendEmailWithTimeout } from '@/lib/resend/client'
import { getSignedUrl } from '@/lib/storage'
import { workOrderEmailSchema } from '@/lib/validations/work-order'
import { WorkOrderDocument } from '@/lib/pdf/work-order-template'
import { WorkOrderEmail } from '@/components/email/work-order-email'
import type { Shop, Truck, WorkOrder, WorkOrderItem } from '@/types/database'

/**
 * Send a work-order PDF to one or more recipients.
 *
 * Caller posts { id, recipients[], subject? }. We fetch the WO + items +
 * shop + truck + tenant in parallel, render the PDF (same template the
 * Download button uses), and send via Resend with the PDF as an
 * attachment. PDF is generated server-side once, never embedded in the
 * HTML body.
 */
export async function POST(request: Request) {
  // Tighter rate limit (10/min) than the work-order CRUD actions —
  // this is a write that can spam external mailboxes.
  const auth = await authorize('maintenance.update', {
    rateLimit: { key: 'sendWorkOrder', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) {
    const status = auth.error === 'Not authenticated' ? 401 : 403
    return Response.json({ error: auth.error }, { status })
  }
  const { supabase, tenantId, user } = auth.ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = workOrderEmailSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }
  const { id, recipients, subject } = parsed.data

  const [woResult, itemsResult, tenantResult] = await Promise.all([
    supabase
      .from('maintenance_records')
      .select('*, shop:shops(*), truck:trucks(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('work_order_items')
      .select('*')
      .eq('work_order_id', id)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('tenants')
      .select('name, address, city, state, zip, phone, dot_number, mc_number, logo_storage_path')
      .eq('id', tenantId)
      .single(),
  ])

  if (woResult.error || !woResult.data) {
    return Response.json({ error: 'Work order not found' }, { status: 404 })
  }
  const wo = woResult.data as unknown as WorkOrder & { shop: Shop | null; truck: Truck | null }
  const items = (itemsResult.data ?? []) as WorkOrderItem[]
  const tenant = tenantResult.data
  if (!tenant) {
    return Response.json({ error: 'Tenant information not found' }, { status: 500 })
  }

  let logoUrl: string | null = null
  if (tenant.logo_storage_path) {
    const signed = await getSignedUrl(supabase, 'branding', tenant.logo_storage_path, 3600)
    logoUrl = signed.url || null
  }

  // Render PDF once, attach to outgoing email.
  let pdfBuffer: Buffer
  try {
    const buffer = await renderToBuffer(
      WorkOrderDocument({
        workOrder: wo,
        shop: wo.shop,
        truck: wo.truck,
        items,
        tenant,
        logoUrl,
      }),
    )
    pdfBuffer = Buffer.from(buffer)
  } catch (err) {
    console.error('[work-order-send] PDF render failed', err)
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }

  // Sanitize the wo_number for the attachment filename header
  const woRef = wo.wo_number ? `WO-${wo.wo_number}` : `WO-${id.slice(0, 8).toUpperCase()}`
  const safeFilename = woRef.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64)

  // Truck label for the email body
  const truckLabel = wo.truck
    ? [wo.truck.year, wo.truck.make, wo.truck.model].filter(Boolean).join(' ') ||
      `Unit ${wo.truck.unit_number ?? ''}`
    : null

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const senderName = user.email ? user.email.split('@')[0] : null
  const finalSubject = subject?.trim() || `Work Order ${woRef}${tenant.name ? ` from ${tenant.name}` : ''}`

  let sendResult: Awaited<ReturnType<typeof sendEmailWithTimeout>>
  try {
    sendResult = await sendEmailWithTimeout(() =>
      getResend().emails.send({
        from: `${tenant.name ?? 'VroomX'} <${fromEmail}>`,
        to: recipients,
        subject: finalSubject,
        react: WorkOrderEmail({
          workOrder: wo,
          shopName: wo.shop?.name ?? null,
          truckLabel,
          tenant,
          senderName,
        }),
        attachments: [{ filename: `${safeFilename}.pdf`, content: pdfBuffer }],
      }),
    )
  } catch (err) {
    console.error('[work-order-send] sendEmail threw', err)
    return Response.json({ error: 'Failed to send work-order email' }, { status: 500 })
  }

  const { data, error: emailError } = sendResult
  if (emailError) {
    console.error('[work-order-send] Resend error', emailError)
    return Response.json({ error: 'Failed to send work-order email' }, { status: 500 })
  }

  return Response.json({ success: true, emailId: data?.id, recipients })
}
