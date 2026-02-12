'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/shared/status-badge'
import { TripFinancialCard } from './trip-financial-card'
import { TripStatusActions } from './trip-status-actions'
import { TripOrders } from './trip-orders'
import { TripExpenses } from './trip-expenses'
import {
  Truck,
  User,
  Calendar,
  Package,
  FileText,
} from 'lucide-react'
import {
  TRUCK_TYPE_LABELS,
  TRUCK_CAPACITY,
  DRIVER_TYPE_LABELS,
  DRIVER_PAY_TYPE_LABELS,
} from '@/types'
import type { TripWithRelations } from '@/lib/queries/trips'
import type { TripStatus, TruckType, DriverType, DriverPayType } from '@/types'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface TripDetailProps {
  trip: TripWithRelations
}

export function TripDetail({ trip }: TripDetailProps) {
  const status = trip.status as TripStatus
  const truckType = trip.truck?.truck_type as TruckType | undefined
  const capacity = truckType ? TRUCK_CAPACITY[truckType] : null
  const driverType = trip.driver?.driver_type as DriverType | undefined
  const payType = trip.driver?.pay_type as DriverPayType | undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {trip.trip_number ?? 'Draft Trip'}
          </h1>
          <StatusBadge status={trip.status} type="trip" />
        </div>
        <TripStatusActions
          tripId={trip.id}
          currentStatus={status}
          orderCount={trip.order_count}
        />
      </div>

      {/* Trip Info Bar */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 lg:grid-cols-4">
        {/* Truck */}
        <div className="flex items-start gap-3">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Truck</p>
            {trip.truck ? (
              <Link
                href={`/trucks/${trip.truck.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                #{trip.truck.unit_number}
              </Link>
            ) : (
              <p className="text-sm text-gray-500">Unassigned</p>
            )}
            {truckType && (
              <p className="text-xs text-gray-500">{TRUCK_TYPE_LABELS[truckType]}</p>
            )}
          </div>
        </div>

        {/* Driver */}
        <div className="flex items-start gap-3">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Driver</p>
            {trip.driver ? (
              <Link
                href={`/drivers/${trip.driver.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {trip.driver.first_name} {trip.driver.last_name}
              </Link>
            ) : (
              <p className="text-sm text-gray-500">Unassigned</p>
            )}
            {driverType && (
              <p className="text-xs text-gray-500">
                {DRIVER_TYPE_LABELS[driverType]}
                {payType && ` - ${DRIVER_PAY_TYPE_LABELS[payType]}`}
              </p>
            )}
          </div>
        </div>

        {/* Date Range */}
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Date Range</p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(trip.start_date)} - {formatDate(trip.end_date)}
            </p>
          </div>
        </div>

        {/* Capacity */}
        <div className="flex items-start gap-3">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Capacity</p>
            <p className="text-sm font-medium text-gray-900">
              {trip.order_count}{capacity !== null ? ` / ${capacity}` : ''} orders
            </p>
            {capacity !== null && trip.order_count > capacity && (
              <p className="text-xs font-medium text-amber-600">Over capacity</p>
            )}
          </div>
        </div>
      </div>

      {/* Route Summary */}
      {(trip.origin_summary || trip.destination_summary) && (
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Route:</span>{' '}
            {trip.origin_summary ?? '?'} → {trip.destination_summary ?? '?'}
          </p>
        </div>
      )}

      {/* Financial Summary Card */}
      <TripFinancialCard trip={trip} />

      {/* Two-column layout: Orders (wider) + Expenses (narrower) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TripOrders
            tripId={trip.id}
            truckType={truckType}
          />
        </div>
        <div>
          <TripExpenses tripId={trip.id} />
        </div>
      </div>

      {/* Notes */}
      {trip.notes && (
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{trip.notes}</p>
        </div>
      )}
    </div>
  )
}
