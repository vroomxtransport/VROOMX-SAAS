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
import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-is-mobile'

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

/**
 * Priority order for mobile dispatcher view.
 * Widgets not listed here fall to the end in their original order.
 */
const MOBILE_PRIORITY: Exclude<WidgetId, 'statCards'>[] = [
  'upcomingPickups',
  'loadsPipeline',
  'fleetPulse',
  'activityFeed',
  'dispatchEfficiency',
  'topDrivers',
  'revenueChart',
  'openInvoices',
  'arAgingChart',
  'recentPayments',
  'paymentStatusBreakdown',
  'pnlSummary',
  'brokerScorecardMini',
  'revenueForecast',
  'quickLinks',
]

function mobileSort(
  widgets: ReturnType<typeof useVisibleWidgets>
): ReturnType<typeof useVisibleWidgets> {
  return [...widgets].sort((a, b) => {
    const ai = MOBILE_PRIORITY.indexOf(a.id as Exclude<WidgetId, 'statCards'>)
    const bi = MOBILE_PRIORITY.indexOf(b.id as Exclude<WidgetId, 'statCards'>)
    const aIdx = ai === -1 ? 999 : ai
    const bIdx = bi === -1 ? 999 : bi
    return aIdx - bIdx
  })
}

// ---------------------------------------------------------------------------
// Mobile widget card with expand/collapse toggle
// ---------------------------------------------------------------------------

interface MobileWidgetCardProps {
  widgetId: string
  children: ReactNode
}

function MobileWidgetCard({ widgetId, children }: MobileWidgetCardProps) {
  const [expanded, setExpanded] = useState(false)

  // A few widgets benefit from always being fully visible on mobile
  const alwaysExpanded = ['upcomingPickups', 'loadsPipeline'].includes(widgetId)

  if (alwaysExpanded) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {children}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden',
          expanded ? 'max-h-[600px]' : 'max-h-[280px]'
        )}
      >
        {children}
      </div>

      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium',
          'text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors',
          'border-t border-border'
        )}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            Show more
          </>
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardWidgets(props: DashboardWidgetsProps) {
  const { editMode, setGridLayout } = useDashboardStore()
  const layout = useDashboardStore((s) => s.viewLayouts[s.activeView])
  const visibleWidgets = useVisibleWidgets()
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 })
  const { isMobile } = useIsMobile()

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

  // Mobile: sort by priority
  const mobileWidgets = useMemo(() => mobileSort(renderedWidgets), [renderedWidgets])

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
    return renderedWidgets.reduce<LayoutItem[]>((acc, w) => {
      const cumY = acc.reduce((sum, item) => sum + item.h, 0)
      acc.push({ i: w.id, x: 0, y: cumY, w: 1, h: w.grid.h, minH: w.grid.minH, static: true })
      return acc
    }, [])
  }, [renderedWidgets])

  const handleLayoutChange = useCallback(
    (layout: Layout, _layouts: ResponsiveLayouts) => {
      if (!editMode) return
      setGridLayout(layout)
    },
    [editMode, setGridLayout]
  )

  // ---------------------------------------------------------------------------
  // Mobile layout — simple vertical stack, no react-grid-layout
  // ---------------------------------------------------------------------------
  if (isMobile) {
    return (
      <>
        {statCardsVisible && props.statCards}

        {mobileWidgets.length > 0 && (
          <div className="space-y-3 mt-3">
            {mobileWidgets.map((widget) => {
              const propKey = widgetContent[widget.id as Exclude<WidgetId, 'statCards'>]
              const content = props[propKey]
              if (!content) return null

              return (
                <MobileWidgetCard key={widget.id} widgetId={widget.id}>
                  {content}
                </MobileWidgetCard>
              )
            })}
          </div>
        )}
      </>
    )
  }

  // ---------------------------------------------------------------------------
  // Desktop layout — react-grid-layout (unchanged)
  // ---------------------------------------------------------------------------
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
