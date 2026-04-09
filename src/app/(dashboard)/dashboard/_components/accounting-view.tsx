'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/stores/dashboard-store'
import { DashboardWidgets } from './dashboard-widgets'
import { OpenInvoices } from './open-invoices'
import { RevenueChart } from './revenue-chart'
import { ArAgingChart } from './ar-aging-chart'
import { RecentPayments } from './recent-payments'
import { PaymentStatusBreakdown } from './payment-status-breakdown'
import { QuickLinks } from './quick-links'
import type { ReactNode } from 'react'

interface AccountingViewProps {
  statCards: ReactNode
}

export function AccountingView(props: AccountingViewProps) {
  const initializeForView = useDashboardStore((s) => s.initializeForView)

  useEffect(() => {
    initializeForView('accounting')
  }, [initializeForView])

  return (
    <DashboardWidgets
      statCards={props.statCards}
      openInvoices={<OpenInvoices />}
      revenueChart={<RevenueChart />}
      arAgingChart={<ArAgingChart />}
      recentPayments={<RecentPayments />}
      paymentStatusBreakdown={<PaymentStatusBreakdown />}
      quickLinks={<QuickLinks view="accounting" />}
    />
  )
}
