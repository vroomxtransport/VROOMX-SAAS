'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTruck } from '@/hooks/use-trucks'
import { deleteTruck, updateTruckStatus } from '@/app/actions/trucks'
import { TruckDrawer } from '../_components/truck-drawer'
import { TrailerSection } from './_components/trailer-section'
import { TruckDocuments } from './_components/truck-documents'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Truck,
  Hash,
  FileText,
} from 'lucide-react'
import { TRUCK_TYPE_LABELS } from '@/types'
import type { TruckType, TruckStatus } from '@/types'
import { useQueryClient } from '@tanstack/react-query'

interface TruckDetailPageProps {
  params: Promise<{ id: string }>
}

export default function TruckDetailPage({ params }: TruckDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: truck, isLoading } = useTruck(id)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleStatusChange = async (value: string) => {
    await updateTruckStatus(id, value as TruckStatus)
    queryClient.invalidateQueries({ queryKey: ['truck', id] })
    queryClient.invalidateQueries({ queryKey: ['trucks'] })
  }

  const handleDelete = async () => {
    const result = await deleteTruck(id)
    if (!('error' in result)) {
      router.push('/trucks')
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

  if (!truck) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Truck not found</h2>
        <p className="mt-1 text-sm text-gray-500">
          The truck you are looking for does not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/trucks')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Fleet
        </Button>
      </div>
    )
  }

  const vehicleLine = [truck.year, truck.make, truck.model]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/trucks')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Fleet
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{truck.unit_number}</h1>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={truck.truck_status} type="truck" />
              <Badge variant="outline">
                {TRUCK_TYPE_LABELS[truck.truck_type as TruckType]}
              </Badge>
              {truck.ownership === 'owner_operator' && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-200"
                >
                  Owner-Operator
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
              <span className="text-sm text-gray-600">Status:</span>
              <Select
                value={truck.truck_status}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
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
        {/* Vehicle Info */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Truck className="h-4 w-4" />
            Vehicle Info
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Unit Number</dt>
              <dd className="text-sm text-gray-900">{truck.unit_number}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">VIN</dt>
              <dd className="font-mono text-sm text-gray-900">
                {truck.vin || <span className="text-gray-400">Not provided</span>}
              </dd>
            </div>
            {vehicleLine && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Year / Make / Model</dt>
                <dd className="text-sm text-gray-900">{vehicleLine}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Classification */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Hash className="h-4 w-4" />
            Classification
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Truck Type</dt>
              <dd className="text-sm text-gray-900">
                {TRUCK_TYPE_LABELS[truck.truck_type as TruckType]}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Status</dt>
              <dd className="text-sm text-gray-900">
                <StatusBadge status={truck.truck_status} type="truck" />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Ownership</dt>
              <dd className="text-sm text-gray-900">
                {truck.ownership === 'owner_operator' ? 'Owner-Operator' : 'Company'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Assigned Trips (Placeholder) */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4" />
            Assigned Trips
          </h3>
          <p className="text-sm text-gray-400">
            Trip assignment will be available when the dispatch workflow is built.
          </p>
        </div>

        {/* Maintenance Log (Placeholder) */}
        <div className="rounded-lg border bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4" />
            Maintenance Log
          </h3>
          <p className="text-sm text-gray-400">
            Maintenance tracking will be available in a future update.
          </p>
        </div>
      </div>

      {/* Trailer Section */}
      <div className="mt-6">
        <TrailerSection truckId={id} currentTrailerId={truck.trailer_id} />
      </div>

      {/* Documents Section */}
      <div className="mt-6">
        <TruckDocuments truckId={id} tenantId={truck.tenant_id} />
      </div>

      {/* Notes */}
      {truck.notes && (
        <div className="mt-6 rounded-lg border bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-600">{truck.notes}</p>
        </div>
      )}

      {/* Drawer for editing */}
      <TruckDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        truck={truck}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Truck"
        description={`Are you sure you want to delete truck ${truck.unit_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
