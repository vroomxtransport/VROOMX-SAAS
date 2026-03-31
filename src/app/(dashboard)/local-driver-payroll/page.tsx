import { Suspense } from 'react'
import { LocalDriverPayrollReport } from './_components/local-driver-payroll-report'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Local Driver Payroll | VroomX' }

export default function LocalDriverPayrollPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Local Driver Payroll"
        subtitle="Track local driver earnings from terminal pickup and delivery operations"
      />
      <Suspense fallback={null}>
        <LocalDriverPayrollReport />
      </Suspense>
    </div>
  )
}
