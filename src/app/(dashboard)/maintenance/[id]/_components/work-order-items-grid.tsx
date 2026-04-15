'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Wrench, Package } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { addWorkOrderItem, updateWorkOrderItem } from '@/app/actions/work-orders'
import type { WorkOrderItem } from '@/types/database'
import { WorkOrderItemRow } from './work-order-item-row'

interface WorkOrderItemsGridProps {
  workOrderId: string
  items: WorkOrderItem[]
}

function SortableRow({ item }: { item: WorkOrderItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <WorkOrderItemRow
      item={item}
      dragHandleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      rowRef={setNodeRef}
      rowStyle={style}
    />
  )
}

export function WorkOrderItemsGrid({ workOrderId, items }: WorkOrderItemsGridProps) {
  const [isAddingLabor, startAddLabor] = useTransition()
  const [isAddingPart, startAddPart] = useTransition()
  const [localItems, setLocalItems] = useState<WorkOrderItem[]>(items)

  // Sync incoming realtime items — track by id + updated_at + sort_order so
  // remote edits (other users / other tabs) propagate without clobbering
  // an in-flight local drag. Done in useEffect to keep render pure.
  const remoteKey = items.map((i) => `${i.id}:${i.updated_at}:${i.sort_order}`).join(',')
  useEffect(() => {
    setLocalItems(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleAddItem = (kind: 'labor' | 'part') => {
    const start = kind === 'labor' ? startAddLabor : startAddPart
    start(async () => {
      const result = await addWorkOrderItem({
        workOrderId,
        kind,
        description: kind === 'labor' ? 'Labor' : 'Part',
        quantity: 1,
        unitRate: 0,
        sortOrder: localItems.length,
      })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : `Failed to add ${kind}.`
        toast.error(msg)
      }
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localItems.findIndex((i) => i.id === active.id)
    const newIndex = localItems.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(localItems, oldIndex, newIndex)
    setLocalItems(reordered)

    // Persist sort orders in background — failures are non-critical (realtime resyncs)
    reordered.forEach((item, index) => {
      if (item.sort_order !== index) {
        updateWorkOrderItem({ id: item.id, sortOrder: index }).catch(() => undefined)
      }
    })
  }

  return (
    <div className="widget-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-8 px-1 py-2" aria-label="Reorder" />
              <th className="w-20 px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
              <th className="px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
              <th className="w-20 px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qty</th>
              <th className="w-28 px-1 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate</th>
              <th className="w-28 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
              <th className="w-32 px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mechanic</th>
              <th className="w-32 px-1 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="w-10 px-1 py-2" aria-label="Actions" />
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {localItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      No line items yet. Add labor or parts below.
                    </td>
                  </tr>
                ) : (
                  localItems.map((item) => (
                    <SortableRow key={`${item.id}:${item.updated_at}`} item={item} />
                  ))
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={() => handleAddItem('labor')}
          disabled={isAddingLabor}
        >
          <Wrench className="h-3.5 w-3.5" />
          <Plus className="h-3 w-3 -ml-1" />
          Add labor
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={() => handleAddItem('part')}
          disabled={isAddingPart}
        >
          <Package className="h-3.5 w-3.5" />
          <Plus className="h-3 w-3 -ml-1" />
          Add part
        </Button>
      </div>
    </div>
  )
}
