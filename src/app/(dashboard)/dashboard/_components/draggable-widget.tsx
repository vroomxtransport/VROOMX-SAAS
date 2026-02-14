'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { type ReactNode } from 'react'
import { type WidgetId } from '@/stores/dashboard-store'

const WIDGET_SPANS: Record<Exclude<WidgetId, 'statCards'>, string> = {
  loadsPipeline: 'lg:col-span-8',
  revenueChart: 'lg:col-span-8',
  fleetPulse: 'lg:col-span-4',
  upcomingPickups: 'lg:col-span-4',
  activityFeed: 'lg:col-span-12',
}

interface DraggableWidgetProps {
  id: Exclude<WidgetId, 'statCards'>
  editMode: boolean
  children: ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
}

export function DraggableWidget({
  id,
  editMode,
  children,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const spanClass = WIDGET_SPANS[id]

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        col-span-12 ${spanClass} relative group/widget
        ${isDragging ? 'opacity-50 scale-[0.98] z-50' : ''}
        ${editMode ? 'ring-2 ring-brand/20 rounded-xl' : ''}
      `}
    >
      {editMode && (
        <>
          {/* Desktop drag handle */}
          <button
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center h-10 w-6 rounded-md bg-surface border border-border-subtle shadow-sm opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Mobile up/down buttons */}
          <div className="absolute -top-2 right-2 z-10 flex gap-1 md:hidden">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="flex items-center justify-center h-7 w-7 rounded-md bg-surface border border-border-subtle shadow-sm disabled:opacity-30 transition-opacity"
            >
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="flex items-center justify-center h-7 w-7 rounded-md bg-surface border border-border-subtle shadow-sm disabled:opacity-30 transition-opacity"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </>
      )}

      <div className={editMode ? 'pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  )
}
