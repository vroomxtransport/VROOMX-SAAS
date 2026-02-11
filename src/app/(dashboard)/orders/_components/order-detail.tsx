'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { deleteOrder } from '@/app/actions/orders'
import { OrderStatusActions } from './order-status-actions'
import { OrderTimeline } from './order-timeline'
import { OrderDrawer } from './order-drawer'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Trash2,
  Car,
  MapPin,
  ArrowRight,
  DollarSign,
  Users,
  FileText,
  Clock,
  Building2,
  User,
} from 'lucide-react'
import { PAYMENT_TYPE_LABELS } from '@/types'
import type { OrderStatus } from '@/types'
import type { OrderWithRelations } from '@/lib/queries/orders'

interface OrderDetailProps {
  order: OrderWithRelations
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildAddress(location: string | null, city: string | null, state: string | null, zip: string | null): string {
  const parts = [location, city, state, zip].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Not specified'
}

export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const status = order.status as OrderStatus
  const canDelete = status === 'new'

  const revenue = parseFloat(order.revenue)
  const carrierPay = parseFloat(order.carrier_pay)
  const brokerFee = parseFloat(order.broker_fee)
  const margin = revenue - carrierPay - brokerFee

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

  const vehicleInfo = [
    order.vehicle_year,
    order.vehicle_make,
    order.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ') || 'No vehicle info'

  const handleDelete = useCallback(async () => {
    const result = await deleteOrder(order.id)
    if ('error' in result && result.error) {
      return
    }
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    router.push('/orders')
  }, [order.id, queryClient, router])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {order.order_number ?? 'Draft Order'}
              </h1>
              <StatusBadge status={order.status} type="order" />
            </div>
            <p className="mt-1 text-sm text-gray-500">{vehicleInfo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Status Actions */}
      <OrderStatusActions orderId={order.id} currentStatus={status} />

      {/* Timeline */}
      <div className="rounded-lg border bg-white p-6">
        <OrderTimeline
          currentStatus={status}
          createdAt={order.created_at}
          actualPickupDate={order.actual_pickup_date}
          actualDeliveryDate={order.actual_delivery_date}
        />
      </div>

      {/* Cancelled Reason */}
      {status === 'cancelled' && order.cancelled_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">Cancellation Reason</h3>
          <p className="mt-1 text-sm text-red-700">{order.cancelled_reason}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vehicle Info */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Vehicle Information</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Year / Make / Model</p>
                <p className="text-sm text-gray-900">{vehicleInfo}</p>
              </div>
              {order.vehicle_vin && (
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">VIN</p>
                  <p className="font-mono text-sm text-gray-900">{order.vehicle_vin}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {order.vehicle_type && (
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Type</p>
                  <p className="text-sm text-gray-900">{order.vehicle_type}</p>
                </div>
              )}
              {order.vehicle_color && (
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Color</p>
                  <p className="text-sm text-gray-900">{order.vehicle_color}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Financial Summary</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Revenue</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(revenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Carrier Pay</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(carrierPay)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Broker Fee</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(brokerFee)}</span>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Margin</span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    margin >= 0 ? 'text-green-700' : 'text-red-700'
                  )}
                >
                  {formatCurrency(margin)}
                </span>
              </div>
            </div>
            {order.payment_type && (
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Payment Type</span>
                  <span className="text-sm font-medium text-gray-900">
                    {PAYMENT_TYPE_LABELS[order.payment_type]}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="rounded-lg border bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Route</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {/* Pickup */}
            <div className="flex-1 rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Pickup</p>
              <p className="text-sm font-medium text-gray-900">{pickupAddress}</p>
              {order.pickup_contact_name && (
                <p className="mt-2 text-xs text-gray-600">
                  Contact: {order.pickup_contact_name}
                  {order.pickup_contact_phone && ` - ${order.pickup_contact_phone}`}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Scheduled: {formatDate(order.pickup_date)}
              </p>
              {order.actual_pickup_date && (
                <p className="text-xs text-green-600">
                  Actual: {formatDate(order.actual_pickup_date)}
                </p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center sm:pt-8">
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>

            {/* Delivery */}
            <div className="flex-1 rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Delivery</p>
              <p className="text-sm font-medium text-gray-900">{deliveryAddress}</p>
              {order.delivery_contact_name && (
                <p className="mt-2 text-xs text-gray-600">
                  Contact: {order.delivery_contact_name}
                  {order.delivery_contact_phone && ` - ${order.delivery_contact_phone}`}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Scheduled: {formatDate(order.delivery_date)}
              </p>
              {order.actual_delivery_date && (
                <p className="text-xs text-green-600">
                  Actual: {formatDate(order.actual_delivery_date)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Assignments */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Assignments</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Broker</p>
                {order.broker ? (
                  <Link
                    href={'/brokers/' + order.broker.id}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {order.broker.name}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">Unassigned</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Driver</p>
                {order.driver ? (
                  <Link
                    href={'/drivers/' + order.driver.id}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {order.driver.first_name + ' ' + order.driver.last_name}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-500">Unassigned</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="rounded-lg border bg-white p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        {/* Metadata */}
        <div className={cn(
          'rounded-lg border bg-white p-6',
          !order.notes && 'lg:col-span-1'
        )}>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-gray-500">Created</span>
              <span className="text-sm text-gray-900">{formatDateTime(order.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-gray-500">Updated</span>
              <span className="text-sm text-gray-900">{formatDateTime(order.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Drawer */}
      <OrderDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        order={order}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Order"
        description={`Are you sure you want to delete order "${order.order_number ?? 'Draft'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
