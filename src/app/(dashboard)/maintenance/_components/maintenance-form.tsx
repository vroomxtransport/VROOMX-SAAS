'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { maintenanceSchema, type MaintenanceFormInput } from '@/lib/validations/maintenance'
import { createMaintenanceRecord, updateMaintenanceRecord } from '@/app/actions/maintenance'
import { useDraftStore } from '@/stores/draft-store'
import { useTrucks } from '@/hooks/use-trucks'
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
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS } from '@/types'
import type { MaintenanceRecord } from '@/types/database'
import type { MaintenanceType, MaintenanceStatus } from '@/types'

interface MaintenanceFormProps {
  record?: MaintenanceRecord
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'maintenance-new'

export function MaintenanceForm({ record, onSuccess, onCancel }: MaintenanceFormProps) {
  const isEdit = !!record
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: trucksData } = useTrucks({ pageSize: 200 })
  const trucks = trucksData?.trucks ?? []

  const defaultValues: MaintenanceFormInput = record
    ? {
        truckId: record.truck_id ?? '',
        maintenanceType: record.maintenance_type as MaintenanceType,
        status: record.status as MaintenanceStatus,
        description: record.description ?? '',
        vendor: record.vendor ?? '',
        cost: typeof record.cost === 'string' ? parseFloat(record.cost) : (record.cost ?? 0),
        scheduledDate: record.scheduled_date ?? '',
        odometer: record.odometer ?? undefined,
        notes: record.notes ?? '',
      }
    : {
        truckId: '',
        maintenanceType: 'other' as const,
        status: 'scheduled' as const,
        description: '',
        vendor: '',
        cost: 0,
        scheduledDate: '',
        odometer: undefined,
        notes: '',
      }

  const draft = !isEdit ? loadDraft(DRAFT_KEY) : null

  const form = useForm<MaintenanceFormInput>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: draft
      ? {
          ...defaultValues,
          ...(draft as Partial<MaintenanceFormInput>),
        }
      : defaultValues,
  })

  // Auto-save draft for create mode
  const formValues = form.watch()
  const saveDraftCallback = useCallback(
    (values: MaintenanceFormInput) => {
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

  const onSubmit = async (values: MaintenanceFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateMaintenanceRecord(record.id, values)
        : await createMaintenanceRecord(values)

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {serverError}
          </div>
        )}

        {/* Truck & Type */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="truckId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select truck" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.unit_number}
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
              name="maintenanceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(MAINTENANCE_TYPE_LABELS) as [MaintenanceType, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="mt-3">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(MAINTENANCE_STATUS_LABELS) as [MaintenanceStatus, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Description & Vendor */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Service Info</h4>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the maintenance work..."
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <FormControl>
                    <Input placeholder="Shop name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost ($)</FormLabel>
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

        {/* Schedule & Odometer */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Schedule & Mileage</h4>
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
              name="odometer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Odometer</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Miles"
                      value={field.value != null ? Number(field.value) : ''}
                      onChange={(e) =>
                        field.onChange(e.target.value ? e.target.valueAsNumber : undefined)
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
                  placeholder="Additional notes..."
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Record' : 'Create Record'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
