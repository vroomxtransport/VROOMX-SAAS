'use client'

import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useDashboardStore, useOrderedVisibleWidgets, type WidgetId } from '@/stores/dashboard-store'
import { DraggableWidget } from './draggable-widget'
import { type ReactNode, useState, useCallback } from 'react'

interface DashboardWidgetsProps {
  statCards: ReactNode
  loadsPipeline: ReactNode
  revenueChart: ReactNode
  fleetPulse: ReactNode
  upcomingPickups: ReactNode
  activityFeed: ReactNode
}

const widgetContent: Record<Exclude<WidgetId, 'statCards'>, keyof DashboardWidgetsProps> = {
  loadsPipeline: 'loadsPipeline',
  revenueChart: 'revenueChart',
  fleetPulse: 'fleetPulse',
  upcomingPickups: 'upcomingPickups',
  activityFeed: 'activityFeed',
}

export function DashboardWidgets(props: DashboardWidgetsProps) {
  const { widgetLayout, editMode, reorderWidgets } = useDashboardStore()
  const orderedWidgets = useOrderedVisibleWidgets()
  const [activeId, setActiveId] = useState<string | null>(null)

  const statCardsVisible = widgetLayout.find((w) => w.id === 'statCards')?.visible ?? true

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedWidgets.findIndex((w) => w.id === active.id)
    const newIndex = orderedWidgets.findIndex((w) => w.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(orderedWidgets, oldIndex, newIndex)
    // Rebuild full layout preserving statCards and hidden widgets
    const newLayout = widgetLayout.map((w) => {
      if (w.id === 'statCards') return w
      const idx = reordered.findIndex((r) => r.id === w.id)
      if (idx !== -1) return { ...w, order: idx + 1 }
      return w
    })
    reorderWidgets(newLayout)
  }, [orderedWidgets, widgetLayout, reorderWidgets])

  const handleMoveUp = useCallback((widgetId: Exclude<WidgetId, 'statCards'>) => {
    const idx = orderedWidgets.findIndex((w) => w.id === widgetId)
    if (idx <= 0) return
    const reordered = arrayMove(orderedWidgets, idx, idx - 1)
    const newLayout = widgetLayout.map((w) => {
      if (w.id === 'statCards') return w
      const i = reordered.findIndex((r) => r.id === w.id)
      if (i !== -1) return { ...w, order: i + 1 }
      return w
    })
    reorderWidgets(newLayout)
  }, [orderedWidgets, widgetLayout, reorderWidgets])

  const handleMoveDown = useCallback((widgetId: Exclude<WidgetId, 'statCards'>) => {
    const idx = orderedWidgets.findIndex((w) => w.id === widgetId)
    if (idx === -1 || idx >= orderedWidgets.length - 1) return
    const reordered = arrayMove(orderedWidgets, idx, idx + 1)
    const newLayout = widgetLayout.map((w) => {
      if (w.id === 'statCards') return w
      const i = reordered.findIndex((r) => r.id === w.id)
      if (i !== -1) return { ...w, order: i + 1 }
      return w
    })
    reorderWidgets(newLayout)
  }, [orderedWidgets, widgetLayout, reorderWidgets])

  const orderedWidgetIds = orderedWidgets.map((w) => w.id)

  return (
    <>
      {statCardsVisible && props.statCards}

      {orderedWidgets.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedWidgetIds} strategy={verticalListSortingStrategy}>
            <section className="grid gap-3 grid-cols-12 items-start">
              {orderedWidgets.map((widget, index) => (
                <DraggableWidget
                  key={widget.id}
                  id={widget.id as Exclude<WidgetId, 'statCards'>}
                  editMode={editMode}
                  onMoveUp={() => handleMoveUp(widget.id as Exclude<WidgetId, 'statCards'>)}
                  onMoveDown={() => handleMoveDown(widget.id as Exclude<WidgetId, 'statCards'>)}
                  isFirst={index === 0}
                  isLast={index === orderedWidgets.length - 1}
                >
                  {props[widgetContent[widget.id as Exclude<WidgetId, 'statCards'>]]}
                </DraggableWidget>
              ))}
            </section>
          </SortableContext>
          <DragOverlay>
            {activeId && (
              <div className="rounded-xl bg-surface/80 border border-brand/30 shadow-lg backdrop-blur-sm p-8 text-center text-sm text-muted-foreground">
                Moving widget...
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </>
  )
}
