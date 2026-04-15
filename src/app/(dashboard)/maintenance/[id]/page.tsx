import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchWorkOrderDetail } from '@/lib/queries/work-orders'
import { hasPermission, getBuiltInRolePermissions } from '@/lib/permissions'
import { WorkOrderDetail } from './_components/work-order-detail'

export const metadata = { title: 'Work Order | VroomX' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function WorkOrderDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Auth: get user + tenant
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    notFound()
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) notFound()

  // Fetch the work order detail (RLS enforces tenant isolation)
  const wo = await fetchWorkOrderDetail(supabase, id)
  if (!wo || wo.tenant_id !== tenantId) notFound()

  // Resolve canClose permission server-side
  const role: string = user.app_metadata?.role ?? ''
  const permissions = getBuiltInRolePermissions(role) ?? []
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
