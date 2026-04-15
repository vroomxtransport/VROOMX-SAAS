import { notFound, redirect } from 'next/navigation'
import { authorize } from '@/lib/authz'
import { fetchWorkOrderDetail } from '@/lib/queries/work-orders'
import { hasPermission } from '@/lib/permissions'
import { WorkOrderDetail } from './_components/work-order-detail'

export const metadata = { title: 'Work Order | VroomX' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkOrderDetailPage({ params }: Props) {
  const { id } = await params

  // authorize() resolves both built-in AND custom-role permissions via the
  // custom_roles DB lookup — using getBuiltInRolePermissions() directly
  // returned [] for custom roles and silently hid the Close button for
  // legitimate users (audit finding CRITICAL-1).
  const auth = await authorize('maintenance.view')
  if (!auth.ok) redirect('/login')
  const { supabase, tenantId, permissions } = auth.ctx

  const wo = await fetchWorkOrderDetail(supabase, id)
  if (!wo || wo.tenant_id !== tenantId) notFound()

  const canClose = hasPermission(permissions, 'maintenance.close')

  // Fetch tenant name for customer card
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .maybeSingle()

  const tenantName = (tenantRow as { name?: string } | null)?.name ?? 'Your Company'

  return (
    <WorkOrderDetail
      initialData={wo}
      canClose={canClose}
      tenantName={tenantName}
    />
  )
}
