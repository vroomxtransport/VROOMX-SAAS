'use client'

import { Building2, Phone, Mail as MailIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SHOP_KIND_LABELS } from '@/types'
import type { Shop } from '@/types/database'
import { ShopSelectorPopover } from './shop-selector-popover'

interface WorkOrderShopCardProps {
  workOrderId: string
  shop: Shop | null
}

export function WorkOrderShopCard({ workOrderId, shop }: WorkOrderShopCardProps) {
  return (
    <div className="widget-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shop</p>
        </div>
        <ShopSelectorPopover workOrderId={workOrderId} currentShopId={shop?.id ?? null} />
      </div>

      {shop ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{shop.name}</p>
            <Badge variant="outline" className="text-xs">
              {SHOP_KIND_LABELS[shop.kind]}
            </Badge>
          </div>

          {shop.contact_name && (
            <p className="text-xs text-muted-foreground">{shop.contact_name}</p>
          )}
          <div className="space-y-1">
            {shop.phone && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3 shrink-0" />
                <a href={`tel:${shop.phone}`} className="hover:text-foreground transition-colors">
                  {shop.phone}
                </a>
              </div>
            )}
            {shop.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MailIcon className="h-3 w-3 shrink-0" />
                <a href={`mailto:${shop.email}`} className="hover:text-foreground transition-colors truncate">
                  {shop.email}
                </a>
              </div>
            )}
            {(shop.city || shop.state) && (
              <p className="text-xs text-muted-foreground">
                {[shop.city, shop.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No shop assigned</p>
      )}
    </div>
  )
}
