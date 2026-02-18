'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, AlertTriangle, RotateCcw, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateRouteSequence } from '@/app/actions/trips'
import type { Order, RouteStop } from '@/types/database'

interface SequenceStop extends RouteStop {
  id: string // unique key for dnd-kit
  orderNumber: string | null
  city: string | null
  state: string | null
  hasCoords: boolean
}

function buildDefaultSequence(orders: Order[]): RouteStop[] {
  const pickups = [...orders]
    .sort((a, b) => (a.pickup_date ?? '').localeCompare(b.pickup_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'pickup' as const }))

  const deliveries = [...orders]
    .sort((a, b) => (a.delivery_date ?? '').localeCompare(b.delivery_date ?? ''))
    .map((o) => ({ orderId: o.id, stopType: 'delivery' as const }))

  return [...pickups, ...deliveries]
}

function enrichStops(sequence: RouteStop[], orders: Order[]): SequenceStop[] {
  const orderMap = new Map(orders.map((o) => [o.id, o]))
  return sequence.map((stop, i) => {
    const order = orderMap.get(stop.orderId)
    const isPickup = stop.stopType === 'pickup'
    return {
      ...stop,
      id: `${stop.orderId}-${stop.stopType}-${i}`,
      orderNumber: order?.order_number ?? null,
      city: isPickup ? (order?.pickup_city ?? null) : (order?.delivery_city ?? null),
      state: isPickup ? (order?.pickup_state ?? null) : (order?.delivery_state ?? null),
      hasCoords: isPickup
        ? (order?.pickup_latitude != null && order?.pickup_longitude != null)
        : (order?.delivery_latitude != null && order?.delivery_longitude != null),
    }
  })
}

function getWarnings(stops: SequenceStop[]): string[] {
  const warnings: string[] = []
  // Check if any delivery appears before its pickup for the same order
  const seenPickups = new Set<string>()
  for (const stop of stops) {
    if (stop.stopType === 'pickup') {
      seenPickups.add(stop.orderId)
    } else if (stop.stopType === 'delivery' && !seenPickups.has(stop.orderId)) {
      warnings.push(
        `Delivery for ${stop.orderNumber ?? 'order'} appears before its pickup`
      )
    }
  }
  return warnings
}

// ------------- Sortable Item -------------

function SortableStop({ stop, index }: { stop: SequenceStop; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isPickup = stop.stopType === 'pickup'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 bg-surface ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      }`}
    >
      <button
        className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: isPickup ? '#16a34a' : '#dc2626' }}
      >
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground truncate">
            {stop.orderNumber ?? 'Draft'}
          </span>
          <span className={`text-[10px] font-semibold uppercase px-1 py-0.5 rounded ${
            isPickup
              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
          }`}>
            {isPickup ? 'Pickup' : 'Delivery'}
          </span>
          {!stop.hasCoords && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">No coords</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {[stop.city, stop.state].filter(Boolean).join(', ') || 'No address'}
        </p>
      </div>
    </div>
  )
}

// ------------- Main Component -------------

interface TripRouteSequenceProps {
  tripId: string
  orders: Order[]
  savedSequence: RouteStop[] | null
  onSequenceChange: (sequence: RouteStop[]) => void
}

export function TripRouteSequence({
  tripId,
  orders,
  savedSequence,
  onSequenceChange,
}: TripRouteSequenceProps) {
  const defaultSeq = useMemo(() => buildDefaultSequence(orders), [orders])
  const initialSequence = savedSequence && savedSequence.length > 0 ? savedSequence : defaultSeq

  const [localSequence, setLocalSequence] = useState<RouteStop[]>(initialSequence)
  const [isSaving, setIsSaving] = useState(false)

  const enriched = useMemo(() => enrichStops(localSequence, orders), [localSequence, orders])
  const warnings = useMemo(() => getWarnings(enriched), [enriched])

  const isDirty = useMemo(() => {
    const saved = savedSequence && savedSequence.length > 0 ? savedSequence : defaultSeq
    if (localSequence.length !== saved.length) return true
    return localSequence.some(
      (s, i) => s.orderId !== saved[i].orderId || s.stopType !== saved[i].stopType
    )
  }, [localSequence, savedSequence, defaultSeq])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = enriched.findIndex((s) => s.id === active.id)
      const newIndex = enriched.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(enriched, oldIndex, newIndex)
      const newSeq: RouteStop[] = reordered.map((s) => ({
        orderId: s.orderId,
        stopType: s.stopType,
      }))
      setLocalSequence(newSeq)
      onSequenceChange(newSeq)
    },
    [enriched, onSequenceChange]
  )

  const handleAutoSequence = useCallback(() => {
    setLocalSequence(defaultSeq)
    onSequenceChange(defaultSeq)
  }, [defaultSeq, onSequenceChange])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const result = await updateRouteSequence({
        tripId,
        sequence: localSequence,
      })
      if ('error' in result && result.error) {
        console.error('Failed to save route sequence:', result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }, [tripId, localSequence])

  return (
    <div className="flex flex-col gap-3">
      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoSequence}
          disabled={isSaving}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Auto-sequence
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          Save
        </Button>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={enriched.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
            {enriched.map((stop, i) => (
              <SortableStop key={stop.id} stop={stop} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
