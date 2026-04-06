import { PageHeader } from '@/components/shared/page-header'
import { ReportBuilder } from './_components/report-builder'

export default function ReportBuilderPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Report Builder" subtitle="Create custom reports from your data" />
      <ReportBuilder />
    </div>
  )
}
