'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { localDriveSchema, type LocalDriveFormInput } from '@/lib/validations/local-drive'
import { createLocalDrive, updateLocalDrive } from '@/app/actions/local-drives'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { useDraftStore } from '@/stores/draft-store'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEffect, useState, useCallback } from 'react'
import type { LocalDrive } from '@/types/database'

interface LocalDriveFormProps {
  localDrive?: LocalDrive
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'local-drive-new'

export function LocalDriveForm({ localDrive, onSuccess, onCancel }: LocalDriveFormProps) {
  const isEdit = !!localDrive
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: driversData } = useDrivers({ status: 'active', pageSize: 100 })
  const { data: trucksData } = useTrucks({ status: 'active', pageSize: 100 })

  const defaultValues: LocalDriveFormInput = localDrive
    ? {
        driverId: localDrive.driver_id ?? '',
        truckId: localDrive.truck_id ?? '',
        pickupLocation: localDrive.pickup_location ?? '',
        pickupCity: localDrive.pickup_city ?? '',
        pickupState: localDrive.pickup_state ?? '',
        deliveryLocation: localDrive.delivery_location ?? '',
        deliveryCity: localDrive.delivery_city ?? '',
        deliveryState: localDrive.delivery_state ?? '',
        scheduledDate: localDrive.scheduled_date ?? '',
        revenue: typeof localDrive.revenue === 'string' ? parseFloat(localDrive.revenue) : 0,
        notes: localDrive.notes ?? '',
      }
    : {
        driverId: '',
        truckId: '',
        pickupLocation: '',
        pickupCity: '',
        pickupState: '',
        deliveryLocation: '',
        deliveryCity: '',
        deliveryState: '',
        scheduledDate: '',
        revenue: 0,
        notes: '',
      }

  // Load draft for create mode
  const draft = !isEdit ? loadDraft(DRAFT_KEY) : null

  const form = useForm<LocalDriveFormInput>({
    resolver: zodResolver(localDriveSchema),
    defaultValues: draft
      ? {
          ...defaultValues,
          ...(draft as Partial<LocalDriveFormInput>),
        }
      : defaultValues,
  })

  // Auto-save draft for create mode
  const formValues = form.watch()
  const saveDraftCallback = useCallback(
    (values: LocalDriveFormInput) => {
      if (!isEdit) {
        saveDraft(DRAFT_KEY, values as unknown as Record<string, unknown>)
      }
    },
    [isEdit, saveDraft]
  )

  useEffect(() => {
    if (!isEdit) {
      const timeout = setTimeout(() => {
        saveDraftCallback(formValues)
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [formValues, isEdit, saveDraftCallback])

  const onSubmit = async (values: LocalDriveFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateLocalDrive(localDrive.id, values)
        : await createLocalDrive(values)

      if ('error' in result && result.error) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Validation failed. Please check the form.'
        setServerError(errorMessage)
        return
      }

      if (!isEdit) {
        clearDraft(DRAFT_KEY)
      }
      onSuccess()
    } catch {
      setServerError('An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const drivers = driversData?.drivers ?? []
  const trucks = trucksData?.trucks ?? []

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Assignment */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Assignment</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.first_name} {d.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="truckId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select truck" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {trucks.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          Unit #{t.unit_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pickup */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Pickup</h4>
          <FormField
            control={form.control}
            name="pickupLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="pickupCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Miami" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pickupState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="FL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Delivery */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Delivery</h4>
          <FormField
            control={form.control}
            name="deliveryLocation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="456 Oak Ave" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="deliveryCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Fort Lauderdale" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="deliveryState"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="FL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Schedule & Revenue */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Schedule & Revenue</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="revenue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={typeof field.value === 'number' ? field.value : 0}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this local drive..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Local Drive' : 'Create Local Drive'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
