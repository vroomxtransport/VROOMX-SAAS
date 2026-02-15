'use client'

import { use, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBroker } from '@/hooks/use-brokers'
import { deleteBroker } from '@/app/actions/brokers'
import { BrokerDrawer } from '../_components/broker-drawer'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  Package,
} from 'lucide-react'
import { PAYMENT_TERMS_LABELS } from '@/types'
import { BrokerReceivables } from '../_components/broker-receivables'

export default function BrokerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: broker, isPending, isError, error } = useBroker(id)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleDelete = useCallback(async () => {
    const result = await deleteBroker(id)
    if ('error' in result && result.error) {
      // Error is handled by the dialog staying open
      return
    }
    queryClient.invalidateQueries({ queryKey: ['brokers'] })
    router.push('/brokers')
  }, [id, queryClient, router])

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/brokers')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brokers
        </Button>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Failed to load broker: {error?.message ?? 'Unknown error'}
        </div>
      </div>
    )
  }

  if (!broker) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/brokers')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Brokers
        </Button>
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-700">
          Broker not found.
        </div>
      </div>
    )
  }

  const addressParts = [broker.address, broker.city, broker.state, broker.zip].filter(Boolean)
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/brokers')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Brokers</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{broker.name}</h1>
            {broker.payment_terms && (
              <Badge variant="outline" className="mt-1">
                {PAYMENT_TERMS_LABELS[broker.payment_terms]}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Contact Information
          </h2>
          <div className="space-y-4">
            {broker.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Email</p>
                  <a
                    href={`mailto:${broker.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {broker.email}
                  </a>
                </div>
              </div>
            )}
            {broker.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Phone</p>
                  <a
                    href={`tel:${broker.phone}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {broker.phone}
                  </a>
                </div>
              </div>
            )}
            {fullAddress && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Address</p>
                  <p className="text-sm text-gray-900">{fullAddress}</p>
                </div>
              </div>
            )}
            {!broker.email && !broker.phone && !fullAddress && (
              <p className="text-sm text-gray-500">No contact information provided.</p>
            )}
          </div>
        </div>

        {/* Payment & Billing */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Payment & Billing
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Payment Terms
                </p>
                <p className="text-sm text-gray-900">
                  {broker.payment_terms
                    ? PAYMENT_TERMS_LABELS[broker.payment_terms]
                    : 'Not specified'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Factoring Company
                </p>
                <p className="text-sm text-gray-900">
                  {broker.factoring_company || 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {broker.notes && (
          <div className="rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {broker.notes}
            </p>
          </div>
        )}

        {/* Receivables */}
        <div className="lg:col-span-2">
          <BrokerReceivables brokerId={id} />
        </div>
      </div>

      {/* Edit Drawer */}
      <BrokerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        broker={broker}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Broker"
        description={`Are you sure you want to delete "${broker.name}"? This action cannot be undone. Any orders linked to this broker will lose their broker reference.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
