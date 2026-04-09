'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/stores/dashboard-store'
import { DashboardWidgets } from './dashboard-widgets'
import { RevenueChart } from './revenue-chart'
import { OpenInvoices } from './open-invoices'
import { ActivityFeed } from './activity-feed'
import { TopDrivers } from './top-drivers'
import { PnlSummary } from './pnl-summary'
import { BrokerScorecardMini } from './broker-scorecard-mini'
import { RevenueForecast } from './revenue-forecast'
import { QuickLinks } from './quick-links'
import type { ReactNode } from 'react'

interface OwnerViewProps {
  statCards: ReactNode
  loadsPipeline: ReactNode
  fleetPulse: ReactNode
  upcomingPickups: ReactNode
}

export function OwnerView(props: OwnerViewProps) {
  const initializeForView = useDashboardStore((s) => s.initializeForView)

  useEffect(() => {
    initializeForView('owner')
  }, [initializeForView])

  return (
    <DashboardWidgets
      statCards={props.statCards}
      revenueChart={<RevenueChart />}
      loadsPipeline={props.loadsPipeline}
      fleetPulse={props.fleetPulse}
      openInvoices={<OpenInvoices />}
      upcomingPickups={props.upcomingPickups}
      activityFeed={<ActivityFeed />}
      topDrivers={<TopDrivers />}
      pnlSummary={<PnlSummary />}
      brokerScorecardMini={<BrokerScorecardMini />}
      revenueForecast={<RevenueForecast />}
      quickLinks={<QuickLinks view="owner" />}
    />
  )
}
