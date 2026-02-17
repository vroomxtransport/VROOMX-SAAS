'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useTrailers } from '@/hooks/use-trailers'
import {
  createTrailer,
  updateTrailer,
  deleteTrailer,
  assignTrailerToTruck,
  unassignTrailerFromTruck,
} from '@/app/actions/trailers'
import { trailerSchema, type TrailerFormInput } from '@/lib/validations/trailer'
import type { Trailer } from '@/types/database'
import { TRAILER_TYPE_LABELS, TRAILER_STATUS_LABELS } from '@/types'
import type { TrailerType, TrailerStatus } from '@/types'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Link2,
  Link2Off,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Truck,
} from 'lucide-react'

interface TrailerSectionProps {
  truckId: string
  currentTrailerId: string | null
}

export function TrailerSection({ truckId, currentTrailerId }: TrailerSectionProps) {
  const queryClient = useQueryClient()
  const { data: trailersData } = useTrailers()
  const trailers = trailersData?.trailers ?? []

  const currentTrailer = currentTrailerId
    ? trailers.find((t) => t.id === currentTrailerId)
    : null

  const availableTrailers = trailers.filter(
    (t) => t.status === 'active' && t.id !== currentTrailerId
  )

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editTrailer, setEditTrailer] = useState<Trailer | null>(null)
  const [deleteTrailerId, setDeleteTrailerId] = useState<string | null>(null)
  const [deleteTrailerLabel, setDeleteTrailerLabel] = useState('')
  const [selectedTrailerId, setSelectedTrailerId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['truck', truckId] })
    queryClient.invalidateQueries({ queryKey: ['trucks'] })
    queryClient.invalidateQueries({ queryKey: ['trailers'] })
  }

  const handleAssign = async () => {
    if (!selectedTrailerId) return
    setIsAssigning(true)
    try {
      await assignTrailerToTruck(truckId, selectedTrailerId)
      invalidate()
      setAssignDialogOpen(false)
      setSelectedTrailerId('')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    setIsUnassigning(true)
    try {
      await unassignTrailerFromTruck(truckId)
      invalidate()
    } finally {
      setIsUnassigning(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTrailerId) return
    await deleteTrailer(deleteTrailerId)
    invalidate()
    setDeleteTrailerId(null)
  }

  const vehicleLine = (trailer: Trailer) =>
    [trailer.year, trailer.make, trailer.model].filter(Boolean).join(' ')

  return (
    <div className="rounded-lg border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Truck className="h-4 w-4" />
          Trailer
        </h3>
        <div className="flex items-center gap-2">
          {currentTrailer && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnassign}
              disabled={isUnassigning}
            >
              <Link2Off className="mr-1.5 h-3.5 w-3.5" />
              {isUnassigning ? 'Removing...' : 'Unassign'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignDialogOpen(true)}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Assign Trailer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Trailer
          </Button>
        </div>
      </div>

      {currentTrailer ? (
        <div className="rounded-md border bg-muted/50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-foreground">
                {currentTrailer.trailer_number}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={currentTrailer.status} type="truck" />
                <span className="text-xs text-muted-foreground">
                  {TRAILER_TYPE_LABELS[currentTrailer.trailer_type as TrailerType]}
                </span>
              </div>
              {vehicleLine(currentTrailer) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {vehicleLine(currentTrailer)}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditTrailer(currentTrailer)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit Trailer
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => {
                    setDeleteTrailerId(currentTrailer.id)
                    setDeleteTrailerLabel(currentTrailer.trailer_number)
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete Trailer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/60">
          No trailer assigned. Assign an existing trailer or create a new one.
        </p>
      )}

      {/* Assign Trailer Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Trailer</DialogTitle>
            <DialogDescription>
              Select an active trailer to assign to this truck.
            </DialogDescription>
          </DialogHeader>
          {availableTrailers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No available trailers. Create a new trailer first.
            </p>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedTrailerId}
                onValueChange={setSelectedTrailerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a trailer" />
                </SelectTrigger>
                <SelectContent>
                  {availableTrailers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.trailer_number} -{' '}
                      {TRAILER_TYPE_LABELS[t.trailer_type as TrailerType]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button
                  onClick={handleAssign}
                  disabled={!selectedTrailerId || isAssigning}
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Trailer Dialog */}
      <TrailerFormDialog
        open={createDialogOpen || !!editTrailer}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false)
            setEditTrailer(null)
          }
        }}
        trailer={editTrailer}
        onSuccess={invalidate}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTrailerId}
        onOpenChange={(open) => {
          if (!open) setDeleteTrailerId(null)
        }}
        title="Delete Trailer"
        description={`Are you sure you want to delete trailer ${deleteTrailerLabel}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ------------------------------------------------------------------
// TrailerFormDialog: inline create/edit form for trailers
// ------------------------------------------------------------------

interface TrailerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trailer: Trailer | null
  onSuccess: () => void
}

function TrailerFormDialog({
  open,
  onOpenChange,
  trailer,
  onSuccess,
}: TrailerFormDialogProps) {
  const isEdit = !!trailer
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultValues: TrailerFormInput = trailer
    ? {
        trailerNumber: trailer.trailer_number,
        trailerType: trailer.trailer_type,
        status: trailer.status,
        year: trailer.year ?? undefined,
        make: trailer.make ?? '',
        model: trailer.model ?? '',
        vin: trailer.vin ?? '',
        notes: trailer.notes ?? '',
      }
    : {
        trailerNumber: '',
        trailerType: 'open' as const,
        status: 'active' as const,
        year: undefined,
        make: '',
        model: '',
        vin: '',
        notes: '',
      }

  const form = useForm<TrailerFormInput>({
    resolver: zodResolver(trailerSchema),
    defaultValues,
  })

  // Reset form when dialog opens/closes or trailer changes
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      form.reset(defaultValues)
      setServerError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = async (values: TrailerFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateTrailer(trailer.id, values)
        : await createTrailer(values)

      if ('error' in result && result.error) {
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : 'Validation failed. Please check the form.'
        setServerError(errorMessage)
        return
      }

      onSuccess()
      handleOpenChange(false)
    } catch {
      setServerError('An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Trailer' : 'New Trailer'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update details for ${trailer.trailer_number}`
              : 'Add a new trailer to your fleet'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
                {serverError}
              </div>
            )}

            <FormField
              control={form.control}
              name="trailerNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trailer Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., TR-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="trailerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="enclosed">Enclosed</SelectItem>
                        <SelectItem value="flatbed">Flatbed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="2024"
                        value={
                          typeof field.value === 'number' ? field.value : ''
                        }
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? e.target.valueAsNumber : undefined
                          )
                        }
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Wabash" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DuraPlate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VIN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="17-character VIN"
                      maxLength={17}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : isEdit
                    ? 'Update Trailer'
                    : 'Create Trailer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
