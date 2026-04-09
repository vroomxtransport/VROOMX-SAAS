'use client'

import {
  ResponsiveGridLayout,
  useContainerWidth,
  type LayoutItem,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDashboardStore, useVisibleWidgets, type WidgetId } from '@/stores/dashboard-store'
import { type ReactNode, useCallback, useMemo } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DashboardWidgetsProps {
  statCards: ReactNode
  // Shared widgets (optional — not every view uses all of them)
  loadsPipeline?: ReactNode
  revenueChart?: ReactNode
  fleetPulse?: ReactNode
  upcomingPickups?: ReactNode
  activityFeed?: ReactNode
  openInvoices?: ReactNode
  topDrivers?: ReactNode
  quickLinks?: ReactNode
  // Dispatcher-specific
  dispatchEfficiency?: ReactNode
  // Accounting-specific
  arAgingChart?: ReactNode
  recentPayments?: ReactNode
  paymentStatusBreakdown?: ReactNode
  // Owner-specific
  pnlSummary?: ReactNode
  brokerScorecardMini?: ReactNode
  revenueForecast?: ReactNode
}

/** Maps each non-statCards WidgetId to the corresponding prop name. */
const widgetContent: Record<Exclude<WidgetId, 'statCards'>, keyof Omit<DashboardWidgetsProps, 'statCards'>> = {
  loadsPipeline: 'loadsPipeline',
  revenueChart: 'revenueChart',
  fleetPulse: 'fleetPulse',
  upcomingPickups: 'upcomingPickups',
  activityFeed: 'activityFeed',
  openInvoices: 'openInvoices',
  topDrivers: 'topDrivers',
  quickLinks: 'quickLinks',
  // New widgets
  dispatchEfficiency: 'dispatchEfficiency',
  arAgingChart: 'arAgingChart',
  recentPayments: 'recentPayments',
  paymentStatusBreakdown: 'paymentStatusBreakdown',
  pnlSummary: 'pnlSummary',
  brokerScorecardMini: 'brokerScorecardMini',
  revenueForecast: 'revenueForecast',
}

export function DashboardWidgets(props: DashboardWidgetsProps) {
  const { editMode, setGridLayout } = useDashboardStore()
  const layout = useDashboardStore((s) => s.viewLayouts[s.activeView])
  const visibleWidgets = useVisibleWidgets()
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 })

  const statCardsVisible = layout.find((w) => w.id === 'statCards')?.visible ?? true

  // Filter visible widgets to only those with a provided ReactNode
  const renderedWidgets = useMemo(
    () =>
      visibleWidgets.filter((w) => {
        const propKey = widgetContent[w.id as Exclude<WidgetId, 'statCards'>]
        return propKey && props[propKey] != null
      }),
    [visibleWidgets, props]
  )

  const lgLayouts = useMemo(
    (): readonly LayoutItem[] =>
      renderedWidgets.map((w) => ({
        i: w.id,
        x: w.grid.x,
        y: w.grid.y,
        w: w.grid.w,
        h: w.grid.h,
        minW: w.grid.minW,
        minH: w.grid.minH,
        static: !editMode,
      })),
    [renderedWidgets, editMode]
  )

  const smLayouts = useMemo((): readonly LayoutItem[] => {
    let cumY = 0
    return renderedWidgets.map((w) => {
      const item = { i: w.id, x: 0, y: cumY, w: 1, h: w.grid.h, minH: w.grid.minH, static: true }
      cumY += w.grid.h
      return item
    })
  }, [renderedWidgets])

  const handleLayoutChange = useCallback(
    (layout: Layout, _layouts: ResponsiveLayouts) => {
      if (!editMode) return
      setGridLayout(layout)
    },
    [editMode, setGridLayout]
  )

  return (
    <>
      {statCardsVisible && props.statCards}

      <div ref={containerRef}>
        {mounted && renderedWidgets.length > 0 && (
          <ResponsiveGridLayout
            width={width}
            layouts={{ lg: lgLayouts, sm: smLayouts }}
            breakpoints={{ lg: 1024, sm: 0 }}
            cols={{ lg: 12, sm: 1 }}
            rowHeight={40}
            margin={[12, 12] as const}
            containerPadding={[0, 0] as const}
            autoSize
            dragConfig={{ enabled: editMode, handle: '.widget-drag-handle' }}
            resizeConfig={{ enabled: editMode, handles: ['se', 's', 'e'] }}
            onLayoutChange={handleLayoutChange}
          >
            {renderedWidgets.map((widget) => (
              <div
                key={widget.id}
                className={cn(
                  'relative group/widget h-full w-full',
                  editMode && 'ring-2 ring-brand/20 rounded-xl'
                )}
              >
                {editMode && (
                  <div className="widget-drag-handle absolute top-2 left-2 z-10 flex items-center justify-center h-7 w-7 rounded-md bg-surface/90 border border-border-subtle shadow-sm cursor-grab active:cursor-grabbing opacity-0 group-hover/widget:opacity-100 transition-opacity">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="h-full w-full">
                  {props[widgetContent[widget.id as Exclude<WidgetId, 'statCards'>]]}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>
    </>
  )
}
