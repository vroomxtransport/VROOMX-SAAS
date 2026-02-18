'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { deleteOrder } from '@/app/actions/orders'
import { OrderStatusActions } from './order-status-actions'
import { OrderHeaderBar } from './order-header-bar'
import { OrderTimelineEnhanced } from './order-timeline-enhanced'
import { OrderRouteVisual } from './order-route-visual'
import { OrderInspections } from './order-inspections'
import { OrderDrawer } from './order-drawer'
import { AssignToTrip } from './assign-to-trip'
import { PaymentRecorder } from './payment-recorder'
import { InvoiceButton } from './invoice-button'
import { OrderAttachments } from './order-attachments'
import { OrderActivityLog } from './order-activity-log'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Car,
  DollarSign,
  Users,
  FileText,
  Clock,
  Building2,
  User,
  Receipt,
  ExternalLink,
} from 'lucide-react'
import { PAYMENT_TYPE_LABELS } from '@/types'
import type { OrderStatus, TripStatus, PaymentStatus } from '@/types'
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
  const localFee = parseFloat(order.local_fee || '0')
  const driverPayRateOverride = order.driver_pay_rate_override ? parseFloat(order.driver_pay_rate_override) : null
  const margin = revenue - carrierPay - brokerFee - localFee
  const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0

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
    <div className="space-y-4">
      {/* Header Bar */}
      <OrderHeaderBar
        order={order}
        onEdit={() => setDrawerOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
        canDelete={canDelete}
      />

      {/* Status Actions */}
      <OrderStatusActions orderId={order.id} currentStatus={status} />

      {/* Timeline */}
      <OrderTimelineEnhanced
        currentStatus={status}
        createdAt={order.created_at}
        actualPickupDate={order.actual_pickup_date}
        actualDeliveryDate={order.actual_delivery_date}
      />

      {/* Cancelled Reason */}
      {status === 'cancelled' && order.cancelled_reason && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Cancellation Reason</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-400">{order.cancelled_reason}</p>
        </div>
      )}

      {/* Trip Assignment -- shown for orders in assignable statuses */}
      {(['new', 'assigned', 'picked_up'] as OrderStatus[]).includes(status) && (
        <AssignToTrip
          orderId={order.id}
          currentTripId={order.trip?.id ?? null}
          currentTripNumber={order.trip?.trip_number ?? null}
          currentTripStatus={(order.trip?.status as TripStatus) ?? null}
        />
      )}

      {/* Main content grid: 12-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Vehicle Card - Enhanced */}
          <div className="rounded-xl border border-border-subtle bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <Car className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Vehicle Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xl font-semibold text-foreground">{vehicleInfo}</p>
                {order.vehicle_vin && (
                  <p className="mt-2 font-mono text-sm bg-accent/50 rounded px-2 py-1 inline-block">
                    {order.vehicle_vin}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {order.vehicle_type && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
                    <p className="text-sm text-foreground">{order.vehicle_type}</p>
                  </div>
                )}
                {order.vehicle_color && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">Color</p>
                    <p className="text-sm text-foreground">{order.vehicle_color}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Route Visual */}
          <OrderRouteVisual order={order} />

          {/* Inspections */}
          <OrderInspections orderId={order.id} />

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border border-border-subtle bg-surface p-6">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Notes</h2>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Financial Summary - Enhanced */}
          <div className="rounded-xl border border-border-subtle bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Financial Summary</h2>
            </div>

            {/* Large margin display */}
            <div className="mb-4 text-center rounded-lg bg-accent/50 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground">Net Margin</p>
              <p
                className={cn(
                  'text-3xl font-bold tabular-nums',
                  margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {formatCurrency(margin)}
              </p>
              <p
                className={cn(
                  'text-sm tabular-nums',
                  margin >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(1)}%
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Revenue</span>
                <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(revenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Carrier Pay</span>
                <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(carrierPay)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Broker Fee</span>
                <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(brokerFee)}</span>
              </div>
              {localFee > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Local Fee</span>
                  <span className="text-sm font-medium tabular-nums text-foreground">{formatCurrency(localFee)}</span>
                </div>
              )}
              {driverPayRateOverride !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Driver % Override</span>
                  <span className="text-sm font-medium tabular-nums text-foreground">{driverPayRateOverride}%</span>
                </div>
              )}
              {order.payment_type && (
                <div className="border-t border-border-subtle pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment Type</span>
                    <span className="text-sm font-medium text-foreground">
                      {PAYMENT_TYPE_LABELS[order.payment_type]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Billing -- shown for orders past assignment stage */}
          {(['picked_up', 'delivered', 'invoiced', 'paid'] as OrderStatus[]).includes(status) && (
            <div className="rounded-xl border border-border-subtle bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Billing</h2>
                </div>
                <InvoiceButton
                  orderId={order.id}
                  orderNumber={order.order_number}
                  paymentStatus={order.payment_status as PaymentStatus}
                  invoiceDate={order.invoice_date}
                  hasBrokerEmail={!!order.broker?.email}
                />
              </div>
              <PaymentRecorder
                orderId={order.id}
                carrierPay={carrierPay}
                amountPaid={parseFloat(order.amount_paid ?? '0')}
                paymentStatus={order.payment_status as PaymentStatus}
              />
            </div>
          )}

          {/* Assignments - Enhanced */}
          <div className="rounded-xl border border-border-subtle bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Assignments</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Broker</p>
                  {order.broker ? (
                    <Link
                      href={'/brokers/' + order.broker.id}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {order.broker.name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Driver</p>
                  {order.driver ? (
                    <Link
                      href={'/drivers/' + order.driver.id}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {order.driver.first_name + ' ' + order.driver.last_name}
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>
              {order.trip && (
                <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Trip</p>
                    <Link
                      href={'/trips/' + order.trip.id}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {order.trip.trip_number ?? 'View Trip'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attachments */}
      <OrderAttachments orderId={order.id} tenantId={order.tenant_id} />

      {/* Activity Log */}
      <OrderActivityLog orderId={order.id} />

      {/* Metadata footer */}
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Created</span>
            <span className="text-xs font-medium text-foreground">{formatDateTime(order.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Updated</span>
            <span className="text-xs font-medium text-foreground">{formatDateTime(order.updated_at)}</span>
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
