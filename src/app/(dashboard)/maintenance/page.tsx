import Link from 'next/link'
import { Store } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { WorkOrderList } from './_components/work-order-list'
import type { WorkOrder } from '@/types/database'

export const metadata = { title: 'Maintenance / Work Orders | VroomX' }

export default async function MaintenancePage() {
  const supabase = await createClient()

  // Fetch first 50 work orders + shop + truck join for the list
  const { data: woRows } = await supabase
    .from('maintenance_records')
    .select('*, shop:shops(id, name), truck:trucks(id, unit_number)')
    .order('updated_at', { ascending: false })
    .limit(50)

  const workOrders = (woRows ?? []) as unknown as WorkOrder[]

  // Status counts
  const { data: allStatuses } = await supabase
    .from('maintenance_records')
    .select('status')

  const statuses = (allStatuses ?? []).map((r: { status: string }) => r.status)
  const openCount = statuses.filter((s) =>
    ['new', 'in_progress', 'scheduled'].includes(s),
  ).length

  // This-month window
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: thisMonthRows } = await supabase
    .from('maintenance_records')
    .select('status, grand_total, completed_date, closed_at')
    .gte('updated_at', monthStart)

  let completedThisMonth = 0
  let closedThisMonth = 0
  let totalSpend = 0

  for (const row of thisMonthRows ?? []) {
    const r = row as { status: string; grand_total: string | null; completed_date: string | null; closed_at: string | null }
    if (r.status === 'completed' && r.completed_date && r.completed_date >= monthStart) {
      completedThisMonth++
    }
    if (r.status === 'closed' && r.closed_at && r.closed_at >= monthStart) {
      closedThisMonth++
      totalSpend += parseFloat(r.grand_total ?? '0')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance / Work Orders"
        subtitle="Shop work orders, line items, and totals"
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/maintenance/shops">
            <Store className="mr-1.5 h-4 w-4" />
            Manage Shops
          </Link>
        </Button>
      </PageHeader>
      <WorkOrderList
        initialWorkOrders={workOrders}
        openCount={openCount}
        completedThisMonth={completedThisMonth}
        closedThisMonth={closedThisMonth}
        totalSpendThisMonth={totalSpend.toFixed(2)}
      />
    </div>
  )
}
