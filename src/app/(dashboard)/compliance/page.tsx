import { Suspense } from 'react'
import { ComplianceTabs } from './_components/compliance-tabs'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = { title: 'Compliance | VroomX' }

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" subtitle="Track regulatory documents, certifications, and expiration dates" />
      <Suspense fallback={null}>
        <ComplianceTabs />
      </Suspense>
    </div>
  )
}
