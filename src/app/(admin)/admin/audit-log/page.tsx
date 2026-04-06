export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { fetchAuditLogs } from '@/app/actions/admin'
import { AuditLogTable } from '../../_components/audit-log-table'
import { authorizeAdmin } from '@/lib/admin-auth'

// Tenant list for the filter dropdown — fetched once at page load
async function getTenants() {
  const auth = await authorizeAdmin()
  if (!auth.ok) return []
  const { supabase } = auth.ctx

  const { data } = await supabase
    .from('tenants')
    .select('id, name')
    .order('name', { ascending: true })

  return data ?? []
}

interface AuditLogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminAuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams

  const getString = (key: string) => {
    const val = params[key]
    return typeof val === 'string' ? val : undefined
  }

  // Parallel: initial data + tenant list for filter dropdown
  const [logsResult, tenants] = await Promise.all([
    fetchAuditLogs({
      search: getString('search'),
      entityType: getString('entityType'),
      action: getString('action'),
      tenantId: getString('tenantId'),
      startDate: getString('startDate'),
      endDate: getString('endDate'),
      page: parseInt(getString('page') ?? '1', 10),
      pageSize: 50,
    }),
    getTenants(),
  ])

  const initialLogs =
    logsResult.success && 'data' in logsResult ? logsResult.data.logs : []
  const initialTotal =
    logsResult.success && 'data' in logsResult ? logsResult.data.total : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Cross-tenant event trail — search, filter, and export platform activity."
      />

      <Suspense fallback={null}>
        <AuditLogTable
          initialLogs={initialLogs as Parameters<typeof AuditLogTable>[0]['initialLogs']}
          initialTotal={initialTotal}
          tenants={tenants}
        />
      </Suspense>
    </div>
  )
}
