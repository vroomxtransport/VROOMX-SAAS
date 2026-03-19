import { Suspense } from 'react'
import { PayrollPeriodList } from './_components/payroll-period-list'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Payroll | VroomX' }

export default function PayrollPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Dispatcher Payroll" subtitle="Manage dispatcher compensation and payroll periods" />
      <Suspense fallback={null}>
        <PayrollPeriodList />
      </Suspense>
    </div>
  )
}
