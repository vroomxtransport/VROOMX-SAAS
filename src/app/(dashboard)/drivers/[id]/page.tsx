'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDriver } from '@/hooks/use-drivers'
import { deleteDriver, updateDriverStatus } from '@/app/actions/drivers'
import { DriverDrawer } from '../_components/driver-drawer'
import { DriverEarnings } from './_components/driver-earnings'
import { DriverDocuments } from './_components/driver-documents'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Truck,
  DollarSign,
} from 'lucide-react'
import {
  DRIVER_TYPE_LABELS,
  DRIVER_PAY_TYPE_LABELS,
} from '@/types'
import type { DriverType, DriverPayType } from '@/types'
import { useQueryClient } from '@tanstack/react-query'

interface DriverDetailPageProps {
  params: Promise<{ id: string }>
}

function formatPayDisplay(payType: DriverPayType, payRate: number): string {
  switch (payType) {
    case 'percentage_of_carrier_pay':
      return `${payRate}% of Carrier Pay`
    case 'dispatch_fee_percent':
      return `${payRate}% Dispatch Fee`
    case 'per_mile':
      return `$${payRate.toFixed(2)} per mile`
    default:
      return `${payRate}`
  }
}

export default function DriverDetailPage({ params }: DriverDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: driver, isLoading } = useDriver(id)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleStatusToggle = async (checked: boolean) => {
    const newStatus = checked ? 'active' : 'inactive'
    await updateDriverStatus(id, newStatus)
    queryClient.invalidateQueries({ queryKey: ['driver', id] })
    queryClient.invalidateQueries({ queryKey: ['drivers'] })
  }

  const handleDelete = async () => {
    const result = await deleteDriver(id)
    if (!('error' in result)) {
      router.push('/drivers')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Driver not found</h2>
        <p className="mt-1 text-sm text-gray-500">
          The driver you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/drivers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Drivers
        </Button>
      </div>
    )
  }

  const fullName = `${driver.first_name} ${driver.last_name}`
  const payRate = typeof driver.pay_rate === 'string' ? parseFloat(driver.pay_rate) : driver.pay_rate
  const hasAddress = driver.address || driver.city || driver.state || driver.zip

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/drivers')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Drivers
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{fullName}</h1>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={driver.driver_status} type="driver" />
              <Badge variant="outline">
                {DRIVER_TYPE_LABELS[driver.driver_type as DriverType]}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <span className="text-sm text-gray-600">
                {driver.driver_status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <Switch
                checked={driver.driver_status === 'active'}
                onCheckedChange={handleStatusToggle}
                aria-label="Toggle driver status"
              />
            </div>
            <Button variant="outline" onClick={() => setDrawerOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact Info */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Phone className="h-4 w-4" />
            Contact Info
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">
                {driver.email ? (
                  <a href={`mailto:${driver.email}`} className="text-blue-600 hover:underline">
                    {driver.email}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Phone</dt>
              <dd className="text-sm text-gray-900">
                {driver.phone ? (
                  <a href={`tel:${driver.phone}`} className="text-blue-600 hover:underline">
                    {driver.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Address */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4" />
            Address
          </h3>
          {hasAddress ? (
            <div className="text-sm text-gray-900">
              {driver.address && <p>{driver.address}</p>}
              <p>
                {[driver.city, driver.state, driver.zip].filter(Boolean).join(', ')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No address provided</p>
          )}
        </div>

        {/* Driver Details */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CreditCard className="h-4 w-4" />
            Driver Details
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Driver Type</dt>
              <dd className="text-sm text-gray-900">
                {DRIVER_TYPE_LABELS[driver.driver_type as DriverType]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">License Number</dt>
              <dd className="text-sm text-gray-900">
                {driver.license_number || <span className="text-gray-400">Not provided</span>}
              </dd>
            </div>
          </dl>
        </div>

        {/* Pay Configuration */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <DollarSign className="h-4 w-4" />
            Pay Configuration
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Pay Type</dt>
              <dd className="text-sm text-gray-900">
                {DRIVER_PAY_TYPE_LABELS[driver.pay_type as DriverPayType]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Pay Rate</dt>
              <dd className="text-sm font-medium text-gray-900">
                {formatPayDisplay(driver.pay_type as DriverPayType, payRate)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Assigned Orders (Placeholder) */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Truck className="h-4 w-4" />
            Assigned Orders
          </h3>
          <p className="text-sm text-gray-400">
            Order assignment will be available when the dispatch workflow is built.
          </p>
        </div>

        {/* Documents */}
        <DriverDocuments driverId={id} tenantId={driver.tenant_id} />
      </div>

      {/* Earnings -- full width below the grid */}
      <div className="mt-6">
        <DriverEarnings driverId={id} />
      </div>

      {/* Notes */}
      {driver.notes && (
        <div className="mt-6 rounded-lg border bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-600">{driver.notes}</p>
        </div>
      )}

      {/* Drawer for editing */}
      <DriverDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        driver={driver}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Driver"
        description={`Are you sure you want to delete ${fullName}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
