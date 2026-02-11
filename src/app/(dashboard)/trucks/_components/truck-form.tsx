'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { truckSchema, type TruckFormInput } from '@/lib/validations/truck'
import { createTruck, updateTruck } from '@/app/actions/trucks'
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
import { useQueryClient } from '@tanstack/react-query'
import type { Truck } from '@/types/database'

interface TruckFormProps {
  truck?: Truck
  onSuccess: () => void
  onDirtyChange?: (dirty: boolean) => void
}

const DRAFT_KEY = 'truck-new'

export function TruckForm({ truck, onSuccess, onDirtyChange }: TruckFormProps) {
  const isEdit = !!truck
  const queryClient = useQueryClient()
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultValues: TruckFormInput = truck
    ? {
        unitNumber: truck.unit_number,
        truckType: truck.truck_type,
        truckStatus: truck.truck_status,
        year: truck.year ?? undefined,
        make: truck.make ?? '',
        model: truck.model ?? '',
        vin: truck.vin ?? '',
        ownership: (truck.ownership as 'company' | 'owner_operator') ?? 'company',
        notes: truck.notes ?? '',
      }
    : {
        unitNumber: '',
        truckType: '7_car' as const,
        truckStatus: 'active' as const,
        year: undefined,
        make: '',
        model: '',
        vin: '',
        ownership: 'company' as const,
        notes: '',
      }

  // Load draft for create mode
  const draft = !isEdit ? loadDraft(DRAFT_KEY) : null

  const form = useForm<TruckFormInput>({
    resolver: zodResolver(truckSchema),
    defaultValues: draft
      ? {
          ...defaultValues,
          ...(draft as Partial<TruckFormInput>),
        }
      : defaultValues,
  })

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  // Auto-save draft for create mode
  const formValues = form.watch()
  const saveDraftCallback = useCallback(
    (values: TruckFormInput) => {
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

  const onSubmit = async (values: TruckFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateTruck(truck.id, values)
        : await createTruck(values)

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

      queryClient.invalidateQueries({ queryKey: ['trucks'] })
      if (isEdit && truck) {
        queryClient.invalidateQueries({ queryKey: ['truck', truck.id] })
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
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Identity */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Identity</h4>
          <FormField
            control={form.control}
            name="unitNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., T-101" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3">
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
          </div>
        </div>

        {/* Vehicle Info */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Vehicle Info</h4>
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
                      value={typeof field.value === 'number' ? field.value : ''}
                      onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : undefined)}
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
                    <Input placeholder="e.g., Peterbilt" {...field} />
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
                    <Input placeholder="e.g., 389" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Classification */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Classification</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="truckType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Truck Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="7_car">7-Car Hauler</SelectItem>
                      <SelectItem value="8_car">8-Car Hauler</SelectItem>
                      <SelectItem value="9_car">9-Car Hauler</SelectItem>
                      <SelectItem value="flatbed">Flatbed</SelectItem>
                      <SelectItem value="enclosed">Enclosed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="truckStatus"
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
          <div className="mt-3">
            <FormField
              control={form.control}
              name="ownership"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ownership</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select ownership" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="owner_operator">Owner-Operator</SelectItem>
                    </SelectContent>
                  </Select>
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
                  placeholder="Additional notes about this truck..."
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : isEdit
                ? 'Update Truck'
                : 'Create Truck'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
