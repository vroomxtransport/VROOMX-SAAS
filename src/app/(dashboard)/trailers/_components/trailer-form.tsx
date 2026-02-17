'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trailerSchema, type TrailerFormInput } from '@/lib/validations/trailer'
import { createTrailer, updateTrailer } from '@/app/actions/trailers'
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
import type { Trailer } from '@/types/database'

interface TrailerFormProps {
  trailer?: Trailer
  onSuccess: () => void
  onDirtyChange?: (dirty: boolean) => void
}

const DRAFT_KEY = 'trailer-new'

export function TrailerForm({ trailer, onSuccess, onDirtyChange }: TrailerFormProps) {
  const isEdit = !!trailer
  const queryClient = useQueryClient()
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultValues: TrailerFormInput = trailer
    ? {
        trailerNumber: trailer.trailer_number,
        trailerType: trailer.trailer_type as 'open' | 'enclosed' | 'flatbed',
        status: trailer.status as 'active' | 'inactive' | 'maintenance',
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

  const draft = !isEdit ? loadDraft(DRAFT_KEY) : null

  const form = useForm<TrailerFormInput>({
    resolver: zodResolver(trailerSchema),
    defaultValues: draft
      ? {
          ...defaultValues,
          ...(draft as Partial<TrailerFormInput>),
        }
      : defaultValues,
  })

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  const formValues = form.watch()
  const saveDraftCallback = useCallback(
    (values: TrailerFormInput) => {
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

  const onSubmit = async (values: TrailerFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateTrailer(trailer.id, values)
        : await createTrailer(values)

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

      queryClient.invalidateQueries({ queryKey: ['trailers'] })
      if (isEdit && trailer) {
        queryClient.invalidateQueries({ queryKey: ['trailer', trailer.id] })
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
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
            {serverError}
          </div>
        )}

        {/* Identity */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Identity</h4>
          <FormField
            control={form.control}
            name="trailerNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trailer Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., TR-101" {...field} />
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
          <h4 className="mb-3 text-sm font-medium text-foreground">Vehicle Info</h4>
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
                    <Input placeholder="e.g., Wally-Mo" {...field} />
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
                    <Input placeholder="e.g., 7-Car" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Classification */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Classification</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="trailerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trailer Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  placeholder="Additional notes about this trailer..."
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
                ? 'Update Trailer'
                : 'Create Trailer'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
