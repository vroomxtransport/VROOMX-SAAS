import { renderToBuffer } from '@react-pdf/renderer'
import { authorize } from '@/lib/authz'
import { getSignedUrl } from '@/lib/storage'
import { WorkOrderDocument } from '@/lib/pdf/work-order-template'
import type { Shop, Truck, WorkOrder, WorkOrderItem } from '@/types/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await authorize('maintenance.view')
  if (!auth.ok) {
    const status = auth.error === 'Not authenticated' ? 401 : 403
    return Response.json({ error: auth.error }, { status })
  }
  const { supabase, tenantId } = auth.ctx

  // Fetch WO + joins in parallel (items are their own table)
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
    return Response.json({ error: 'Tenant not found' }, { status: 500 })
  }

  // Signed URL for the logo — 1 hour, bucket is private
  let logoUrl: string | null = null
  if (tenant.logo_storage_path) {
    const signed = await getSignedUrl(supabase, 'branding', tenant.logo_storage_path, 3600)
    logoUrl = signed.url || null
  }

  try {
    const pdfBuffer = await renderToBuffer(
      WorkOrderDocument({
        workOrder: wo,
        shop: wo.shop,
        truck: wo.truck,
        items,
        tenant,
        logoUrl,
      }),
    )

    const url = new URL(request.url)
    const inline = url.searchParams.get('inline') === '1'
    const disposition = inline ? 'inline' : 'attachment'
    const filename = `WO-${wo.wo_number ?? id}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[work-order-pdf] render failed', err)
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
