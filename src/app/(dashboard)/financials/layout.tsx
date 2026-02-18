import { PageHeader } from '@/components/shared/page-header'
import { FinancialsNav } from './_components/financials-nav'

export default function FinancialsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Financials" subtitle="Revenue, expenses, KPIs, and profitability analysis" />
      <FinancialsNav />
      {children}
    </div>
  )
}
