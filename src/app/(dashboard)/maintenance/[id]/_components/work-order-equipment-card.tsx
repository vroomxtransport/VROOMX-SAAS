'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ChevronsUpDown, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { updateWorkOrder } from '@/app/actions/work-orders'
import { useTrucks } from '@/hooks/use-trucks'
import type { WorkOrderDetail } from '@/lib/queries/work-orders'

interface WorkOrderEquipmentCardProps {
  workOrderId: string
  wo: WorkOrderDetail
}

export function WorkOrderEquipmentCard({ workOrderId, wo }: WorkOrderEquipmentCardProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { data: trucksData } = useTrucks({ pageSize: 200 })
  const trucks = trucksData?.trucks ?? []

  const truck = wo.truck
  const trailer = wo.trailer

  const equipment = truck ?? trailer
  const isTruck = !!truck

  const equipmentLabel = equipment
    ? [equipment.year, equipment.make, isTruck ? truck?.model : (trailer as typeof wo.trailer)?.model]
        .filter(Boolean)
        .join(' ')
    : null

  const unitNumber = isTruck ? truck?.unit_number : (trailer as typeof wo.trailer)?.trailer_number ?? '—'
  const vin = equipment?.vin ?? null

  const handleSelectTruck = (truckId: string, unitNum: string) => {
    startTransition(async () => {
      const result = await updateWorkOrder(workOrderId, { truckId })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to update equipment.'
        toast.error(msg)
        return
      }

      toast.success(`Equipment updated to ${unitNum}`)
      setPickerOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="widget-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isTruck ? 'Truck' : 'Trailer'}
          </p>
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              Change
              <ChevronsUpDown className="h-3 w-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1" align="end">
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {trucks.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No trucks found.</p>
              ) : (
                trucks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTruck(t.id, t.unit_number)}
                    disabled={isPending}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                      wo.truck_id === t.id && 'bg-accent',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        wo.truck_id === t.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{t.unit_number}</p>
                      {(t.year || t.make) && (
                        <p className="text-xs text-muted-foreground">
                          {[t.year, t.make].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {equipment ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground font-mono tabular-nums">
              {unitNumber}
            </p>
            {equipmentLabel && (
              <Badge variant="outline" className="text-xs">
                {equipmentLabel}
              </Badge>
            )}
          </div>
          {vin && (
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              VIN: {vin}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No equipment assigned</p>
      )}
    </div>
  )
}
