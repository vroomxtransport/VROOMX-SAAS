'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { type ReactNode } from 'react'
import { type WidgetId } from '@/stores/dashboard-store'

const PREFERRED_SPANS: Record<string, number> = {
  loadsPipeline: 8,
  revenueChart: 8,
  fleetPulse: 4,
  upcomingPickups: 4,
  activityFeed: 12,
}

export function computeDynamicSpans(visibleWidgetIds: string[]): Record<string, number> {
  const spans: Record<string, number> = {}
  let col = 0

  for (let i = 0; i < visibleWidgetIds.length; i++) {
    const id = visibleWidgetIds[i]
    let span = PREFERRED_SPANS[id] || 12

    // Start new row if widget doesn't fit
    if (col + span > 12) col = 0

    const afterSpace = 12 - col - span

    if (afterSpace > 0) {
      // Check if next widget fits in remaining space
      const nextId = visibleWidgetIds[i + 1]
      const nextSpan = nextId ? (PREFERRED_SPANS[nextId] || 12) : Infinity
      if (nextSpan > afterSpace) {
        span = 12 - col // expand to fill row
      }
    }

    spans[id] = span
    col += span
    if (col >= 12) col = 0
  }

  return spans
}

interface DraggableWidgetProps {
  id: Exclude<WidgetId, 'statCards'>
  editMode: boolean
  spanClass: string
  children: ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
}

export function DraggableWidget({
  id,
  editMode,
  spanClass,
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
