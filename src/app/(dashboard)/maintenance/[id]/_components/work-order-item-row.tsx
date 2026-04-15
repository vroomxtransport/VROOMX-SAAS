'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { updateWorkOrderItem, deleteWorkOrderItem } from '@/app/actions/work-orders'
import type { WorkOrderItem } from '@/types/database'
import type { WorkOrderItemKind } from '@/types'
import { WORK_ORDER_ITEM_KIND_LABELS } from '@/types'

interface WorkOrderItemRowProps {
  item: WorkOrderItem
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
  rowRef?: (node: HTMLElement | null) => void
  rowStyle?: React.CSSProperties
}

export function WorkOrderItemRow({
  item,
  dragHandleProps,
  isDragging,
  rowRef,
  rowStyle,
}: WorkOrderItemRowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()

  const [description, setDescription] = useState(item.description)
  const [quantity, setQuantity] = useState(item.quantity)
  const [unitRate, setUnitRate] = useState(item.unit_rate)
  const [mechanicName, setMechanicName] = useState(item.mechanic_name ?? '')
  const [serviceDate, setServiceDate] = useState(item.service_date ?? '')
  const [kind, setKind] = useState<WorkOrderItemKind>(item.kind as WorkOrderItemKind)

  const dirtyRef = useRef<Set<string>>(new Set())

  const computedAmount = parseFloat(quantity || '0') * parseFloat(unitRate || '0')

  const save = useCallback((patch: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await updateWorkOrderItem({ id: item.id, ...patch })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to save line item.'
        toast.error(msg)
        return
      }
      router.refresh()
    })
  }, [item.id, router])

  const handleBlur = (field: string, value: unknown) => {
    if (!dirtyRef.current.has(field)) return
    dirtyRef.current.delete(field)
    save({ [field]: value })
  }

  const handleKindToggle = () => {
    const next: WorkOrderItemKind = kind === 'labor' ? 'part' : 'labor'
    setKind(next)
    save({ kind: next })
  }

  const handleDelete = () => {
    startDeleteTransition(async () => {
      const result = await deleteWorkOrderItem(item.id)
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to delete line item.'
        toast.error(msg)
        return
      }
      toast.success('Line item removed')
      router.refresh()
    })
  }

  return (
    <tr
      ref={rowRef as React.Ref<HTMLTableRowElement>}
      style={rowStyle}
      className={cn(
        'group border-b border-border last:border-0 transition-colors',
        isDragging && 'bg-muted/50 shadow-md',
        isPending && 'opacity-70',
      )}
    >
      {/* Drag handle */}
      <td className="w-8 px-1 py-1.5">
        <div
          className="flex cursor-grab items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity active:cursor-grabbing"
          {...(dragHandleProps as React.HTMLAttributes<HTMLDivElement>)}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </td>

      {/* Kind toggle */}
      <td className="w-20 px-1 py-1.5">
        <button
          type="button"
          onClick={handleKindToggle}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors border',
            kind === 'labor'
              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
          )}
          title={`Click to switch to ${kind === 'labor' ? 'Part' : 'Labor'}`}
        >
          {WORK_ORDER_ITEM_KIND_LABELS[kind]}
        </button>
      </td>

      {/* Description */}
      <td className="min-w-[200px] px-1 py-1.5">
        <Input
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            dirtyRef.current.add('description')
          }}
          onBlur={() => handleBlur('description', description)}
          className="h-7 border-transparent bg-transparent text-sm focus:border-border focus:bg-background px-2"
          placeholder="Description"
          maxLength={200}
        />
      </td>

      {/* Qty */}
      <td className="w-20 px-1 py-1.5">
        <Input
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value)
            dirtyRef.current.add('quantity')
          }}
          onBlur={() => handleBlur('quantity', quantity)}
          className="h-7 border-transparent bg-transparent text-right font-mono text-sm tabular-nums focus:border-border focus:bg-background px-2"
          type="number"
          min={0}
          step="any"
          placeholder="1"
        />
      </td>

      {/* Rate */}
      <td className="w-28 px-1 py-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
          <Input
            value={unitRate}
            onChange={(e) => {
              setUnitRate(e.target.value)
              dirtyRef.current.add('unitRate')
            }}
            onBlur={() => handleBlur('unitRate', unitRate)}
            className="h-7 border-transparent bg-transparent pl-4 text-right font-mono text-sm tabular-nums focus:border-border focus:bg-background"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
          />
        </div>
      </td>

      {/* Amount (computed read-only) */}
      <td className="w-28 px-2 py-1.5 text-right">
        <span className="font-mono text-sm tabular-nums text-foreground">
          {isNaN(computedAmount) ? '—' : computedAmount.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
          })}
        </span>
      </td>

      {/* Mechanic */}
      <td className="w-32 px-1 py-1.5">
        <Input
          value={mechanicName}
          onChange={(e) => {
            setMechanicName(e.target.value)
            dirtyRef.current.add('mechanicName')
          }}
          onBlur={() => handleBlur('mechanicName', mechanicName)}
          className="h-7 border-transparent bg-transparent text-sm focus:border-border focus:bg-background px-2"
          placeholder="Mechanic"
          maxLength={120}
        />
      </td>

      {/* Date */}
      <td className="w-32 px-1 py-1.5">
        <Input
          value={serviceDate}
          onChange={(e) => {
            setServiceDate(e.target.value)
            dirtyRef.current.add('serviceDate')
          }}
          onBlur={() => handleBlur('serviceDate', serviceDate)}
          className="h-7 border-transparent bg-transparent text-sm focus:border-border focus:bg-background px-2"
          type="date"
        />
      </td>

      {/* Delete */}
      <td className="w-10 px-1 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          onClick={handleDelete}
          disabled={isDeleting || isPending}
          aria-label="Delete line item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  )
}
