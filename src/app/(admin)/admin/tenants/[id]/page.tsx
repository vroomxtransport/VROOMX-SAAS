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
  starter: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
  pro: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  enterprise: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
}
const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  trialing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  canceled: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
  suspended: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  unpaid: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800',
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
