import { PageHeader } from '@/components/shared/page-header'
import { PnLReportDashboard } from '../_components/pnl-report-dashboard'

export const metadata = {
  title: 'P&L Report | VroomX',
}

export default function PnLReportPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Profit & Loss Statement"
        subtitle="Full operational P&L with revenue waterfall, expenses, and unit metrics"
      />
      <PnLReportDashboard />
    </div>
  )
}
