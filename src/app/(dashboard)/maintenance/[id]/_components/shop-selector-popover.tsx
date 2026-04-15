'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronsUpDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { updateWorkOrder } from '@/app/actions/work-orders'
import { useShops } from '@/hooks/use-shops'
import type { Shop } from '@/types/database'

interface ShopSelectorPopoverProps {
  workOrderId: string
  currentShopId: string | null
}

export function ShopSelectorPopover({ workOrderId, currentShopId }: ShopSelectorPopoverProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { data: shops = [] } = useShops()

  const handleSelect = (shop: Shop) => {
    if (shop.id === currentShopId) {
      setOpen(false)
      return
    }

    startTransition(async () => {
      const result = await updateWorkOrder(workOrderId, { shopId: shop.id })
      const ok =
        !!result &&
        typeof result === 'object' &&
        'success' in result &&
        result.success === true

      if (!ok) {
        const msg =
          result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Failed to update shop.'
        toast.error(msg)
        return
      }

      toast.success(`Shop updated to ${shop.name}`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <div className="space-y-0.5">
          {shops.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No shops found.</p>
          ) : (
            shops.map((shop) => (
              <button
                key={shop.id}
                type="button"
                onClick={() => handleSelect(shop)}
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  shop.id === currentShopId && 'bg-accent',
                )}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    shop.id === currentShopId ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{shop.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{shop.kind}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
