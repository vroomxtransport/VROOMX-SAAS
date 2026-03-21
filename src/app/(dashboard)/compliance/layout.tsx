import type { Metadata } from 'next'
import { PageHeader } from '@/components/shared/page-header'
import { ComplianceNav } from './_components/compliance-nav'

export const metadata: Metadata = {
  title: 'Safety & Compliance | VroomX',
}

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Safety & Compliance"
        subtitle="FMCSA compliance tracking & safety event management"
      />
      <ComplianceNav />
      {children}
    </div>
  )
}
