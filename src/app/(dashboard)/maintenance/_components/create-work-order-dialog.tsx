'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createWorkOrder } from '@/app/actions/work-orders'
import type { Shop } from '@/types/database'

interface Truck {
  id: string
  unit_number: string
  make: string | null
  year: number | null
}

interface CreateWorkOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shops: Shop[]
  trucks: Truck[]
}

export function CreateWorkOrderDialog({
  open,
  onOpenChange,
  shops,
  trucks,
}: CreateWorkOrderDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [shopId, setShopId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    if (!shopId) {
      setFieldErrors({ shopId: ['Please select a shop'] })
      return
    }
    if (!truckId) {
      setFieldErrors({ truckId: ['Please select a truck'] })
      return
    }

    startTransition(async () => {
      const result = await createWorkOrder({
        shopId,
        truckId,
        description: description || undefined,
        scheduledDate: scheduledDate || undefined,
        maintenanceType: 'other',
      })

      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        if (result && typeof result === 'object' && 'error' in result) {
          const err = result.error
          if (typeof err === 'string') {
            toast.error(err)
          } else if (err && typeof err === 'object') {
            setFieldErrors(err as Record<string, string[]>)
          }
        }
        return
      }

      toast.success('Work order created')
      onOpenChange(false)
      setShopId('')
      setTruckId('')
      setDescription('')
      setScheduledDate('')

      if ('workOrder' in result && result.workOrder) {
        router.push(`/maintenance/${result.workOrder.id}`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Work Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Shop */}
          <div className="space-y-1.5">
            <Label htmlFor="wo-shop">Shop <span className="text-destructive">*</span></Label>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger id="wo-shop" className={fieldErrors.shopId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.shopId && (
              <p className="text-xs text-destructive">{fieldErrors.shopId[0]}</p>
            )}
          </div>

          {/* Truck */}
          <div className="space-y-1.5">
            <Label htmlFor="wo-truck">Truck <span className="text-destructive">*</span></Label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger id="wo-truck" className={fieldErrors.truckId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select truck" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.unit_number}
                    {t.make ? ` — ${t.year ?? ''} ${t.make}`.trim() : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.truckId && (
              <p className="text-xs text-destructive">{fieldErrors.truckId[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="wo-desc">Description</Label>
            <Input
              id="wo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of work needed"
              maxLength={500}
            />
          </div>

          {/* Scheduled date */}
          <div className="space-y-1.5">
            <Label htmlFor="wo-date">Scheduled Date</Label>
            <Input
              id="wo-date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
