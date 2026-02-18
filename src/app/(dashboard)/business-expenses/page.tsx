import { PageHeader } from '@/components/shared/page-header'
import { BusinessExpensesDashboard } from './_components/business-expenses-dashboard'

export const metadata = {
  title: 'Business Expenses | VroomX',
}

export default function BusinessExpensesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Business Expenses"
        subtitle="Track fixed and recurring business costs for P&L analysis"
      />
      <BusinessExpensesDashboard />
    </div>
  )
}
