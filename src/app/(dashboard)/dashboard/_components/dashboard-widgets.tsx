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

interface DashboardWidgetsProps {
  statCards: ReactNode
  loadsPipeline: ReactNode
  revenueChart: ReactNode
  fleetPulse: ReactNode
  upcomingPickups: ReactNode
  activityFeed: ReactNode
  openInvoices: ReactNode
  topDrivers: ReactNode
  quickLinks: ReactNode
}

const widgetContent: Record<Exclude<WidgetId, 'statCards'>, keyof DashboardWidgetsProps> = {
  loadsPipeline: 'loadsPipeline',
  revenueChart: 'revenueChart',
  fleetPulse: 'fleetPulse',
  upcomingPickups: 'upcomingPickups',
  activityFeed: 'activityFeed',
  openInvoices: 'openInvoices',
  topDrivers: 'topDrivers',
  quickLinks: 'quickLinks',
}

export function DashboardWidgets(props: DashboardWidgetsProps) {
  const { widgetLayout, editMode, setGridLayout } = useDashboardStore()
  const visibleWidgets = useVisibleWidgets()
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 })

  const statCardsVisible = widgetLayout.find((w) => w.id === 'statCards')?.visible ?? true

  const lgLayouts = useMemo(
    (): readonly LayoutItem[] =>
      visibleWidgets.map((w) => ({
        i: w.id,
        x: w.grid.x,
        y: w.grid.y,
        w: w.grid.w,
        h: w.grid.h,
        minW: w.grid.minW,
        minH: w.grid.minH,
        static: !editMode,
      })),
    [visibleWidgets, editMode]
  )

  // On mobile, stack everything single-column
  const smLayouts = useMemo(
    (): readonly LayoutItem[] =>
      visibleWidgets.map((w, i) => ({
        i: w.id,
        x: 0,
        y: i * 3,
        w: 1,
        h: w.grid.h,
        minH: w.grid.minH,
        static: true,
      })),
    [visibleWidgets]
  )

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
        {mounted && visibleWidgets.length > 0 && (
          <ResponsiveGridLayout
            width={width}
            layouts={{ lg: lgLayouts, sm: smLayouts }}
            breakpoints={{ lg: 1024, sm: 0 }}
            cols={{ lg: 12, sm: 1 }}
            rowHeight={120}
            margin={[12, 12] as const}
            containerPadding={[0, 0] as const}
            autoSize
            dragConfig={{ enabled: editMode, handle: '.widget-drag-handle' }}
            resizeConfig={{ enabled: editMode, handles: ['se'] }}
            onLayoutChange={handleLayoutChange}
          >
            {visibleWidgets.map((widget) => (
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
                <div className="h-full w-full overflow-auto">
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
