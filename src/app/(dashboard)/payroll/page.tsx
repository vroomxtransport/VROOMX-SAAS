import { Suspense } from 'react'
import { PayrollPeriodList } from './_components/payroll-period-list'
import { PageHeader } from '@/components/shared/page-header'
import { FinancialsNav } from '@/app/(dashboard)/financials/_components/financials-nav'

export const metadata = { title: 'Payroll | VroomX' }

export default function PayrollPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Accounting" subtitle="Manage dispatcher compensation and payroll periods" />
      <FinancialsNav />
      <Suspense fallback={null}>
        <PayrollPeriodList />
      </Suspense>
    </div>
  )
}
