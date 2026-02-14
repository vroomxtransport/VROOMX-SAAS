'use client'

import { MapPin } from 'lucide-react'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderRouteVisualProps {
  order: OrderWithRelations
}

function buildAddress(location: string | null, city: string | null, state: string | null, zip: string | null): string {
  const parts = [location, city, state, zip].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Not specified'
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function OrderRouteVisual({ order }: OrderRouteVisualProps) {
  const pickupAddress = buildAddress(
    order.pickup_location,
    order.pickup_city,
    order.pickup_state,
    order.pickup_zip
  )
  const deliveryAddress = buildAddress(
    order.delivery_location,
    order.delivery_city,
    order.delivery_state,
    order.delivery_zip
  )

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Route</h2>
      </div>

      {/* Route visual */}
      <div className="space-y-0">
        {/* Pickup point */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center pt-1">
            <div className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
            <div className="border-l-2 border-dashed border-border-subtle ml-0 h-10" />
          </div>
          <div className="flex-1 pb-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pickup</p>
            <p className="text-sm font-medium text-foreground">{pickupAddress}</p>
            {order.pickup_contact_name && (
              <p className="mt-1 text-xs text-muted-foreground">
                {order.pickup_contact_name}
                {order.pickup_contact_phone && ` - ${order.pickup_contact_phone}`}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Scheduled: {formatDate(order.pickup_date)}
              </p>
              {order.actual_pickup_date && (
                <p className="text-xs text-emerald-600">
                  Actual: {formatDate(order.actual_pickup_date)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Delivery point */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center pt-1">
            <div className="h-4 w-4 rounded-full bg-brand ring-4 ring-brand/10" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Delivery</p>
            <p className="text-sm font-medium text-foreground">{deliveryAddress}</p>
            {order.delivery_contact_name && (
              <p className="mt-1 text-xs text-muted-foreground">
                {order.delivery_contact_name}
                {order.delivery_contact_phone && ` - ${order.delivery_contact_phone}`}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Scheduled: {formatDate(order.delivery_date)}
              </p>
              {order.actual_delivery_date && (
                <p className="text-xs text-emerald-600">
                  Actual: {formatDate(order.actual_delivery_date)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
