import { notFound } from 'next/navigation'
import { fetchTenantDetail } from '@/app/actions/admin'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TenantDetail } from '@/app/(admin)/_components/tenant-detail'
import { TenantActionsWrapper } from '@/app/(admin)/_components/tenant-actions-wrapper'
import { Settings2 } from 'lucide-react'

interface TenantDetailPageProps {
  params: Promise<{ id: string }>
}

const PLAN_COLORS: Record<string, string> = {
  owner_operator: 'text-emerald-700 border-emerald-200',
  starter_x:      'bg-brand/10 text-brand border-brand/20',
  pro_x:          'text-blue-700 border-blue-200',
}
const PLAN_LABELS: Record<string, string> = {
  owner_operator: 'Owner-Operator',
  starter_x:      'Starter X',
  pro_x:          'Pro X',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-700 border-emerald-200',
  trialing: 'text-blue-700 border-blue-200',
  past_due: 'text-amber-700 border-amber-200',
  canceled: 'text-gray-500 border-gray-200',
  suspended: 'text-red-700 border-red-200',
  unpaid: 'text-orange-700 border-orange-200',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
  suspended: 'Suspended',
  unpaid: 'Unpaid',
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = await params

  const result = await fetchTenantDetail(id)

  if ('error' in result || !result.success) {
    notFound()
  }

  const { tenant } = result.data
  const effStatus = tenant.is_suspended ? 'suspended' : tenant.subscription_status

  return (
    <div className="space-y-6">
      {/* Page header with plan + status badges */}
      <PageHeader
        title={tenant.name}
        subtitle={`Slug: ${tenant.slug}`}
      >
        <Badge variant="outline" className={`text-xs ${PLAN_COLORS[tenant.plan] ?? ''}`}>
          {PLAN_LABELS[tenant.plan] ?? tenant.plan}
        </Badge>
        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[effStatus] ?? ''}`}>
          {STATUS_LABELS[effStatus] ?? effStatus}
        </Badge>
      </PageHeader>

      {/* Core detail sections (server-rendered) */}
      <TenantDetail data={result.data} />

      {/* Actions section (client component) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Admin Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TenantActionsWrapper
            tenantId={tenant.id}
            tenantName={tenant.name}
            isSuspended={tenant.is_suspended}
          />
        </CardContent>
      </Card>
    </div>
  )
}
