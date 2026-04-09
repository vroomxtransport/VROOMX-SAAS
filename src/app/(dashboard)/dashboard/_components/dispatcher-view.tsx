'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/stores/dashboard-store'
import { DashboardWidgets } from './dashboard-widgets'
import { ActivityFeed } from './activity-feed'
import { TopDrivers } from './top-drivers'
import { DispatchEfficiency } from './dispatch-efficiency'
import { QuickLinks } from './quick-links'
import type { ReactNode } from 'react'

interface DispatcherViewProps {
  statCards: ReactNode
  loadsPipeline: ReactNode
  fleetPulse: ReactNode
  upcomingPickups: ReactNode
}

export function DispatcherView(props: DispatcherViewProps) {
  const initializeForView = useDashboardStore((s) => s.initializeForView)

  useEffect(() => {
    initializeForView('dispatcher')
  }, [initializeForView])

  return (
    <DashboardWidgets
      statCards={props.statCards}
      loadsPipeline={props.loadsPipeline}
      fleetPulse={props.fleetPulse}
      upcomingPickups={props.upcomingPickups}
      activityFeed={<ActivityFeed />}
      topDrivers={<TopDrivers />}
      dispatchEfficiency={<DispatchEfficiency />}
      quickLinks={<QuickLinks view="dispatcher" />}
    />
  )
}
