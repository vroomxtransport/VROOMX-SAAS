import { Suspense } from 'react'
import { LocalDriverPayrollReport } from './_components/local-driver-payroll-report'
import { PageHeader } from '@/components/shared/page-header'
import { FinancialsNav } from '@/app/(dashboard)/financials/_components/financials-nav'

export const metadata = { title: 'Local Driver Payroll | VroomX' }

export default function LocalDriverPayrollPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounting"
        subtitle="Track local driver earnings from terminal pickup and delivery operations"
      />
      <FinancialsNav />
      <Suspense fallback={null}>
        <LocalDriverPayrollReport />
      </Suspense>
    </div>
  )
}
