'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { brokerSchema, type BrokerFormValues } from '@/lib/validations/broker'
import { createBroker, updateBroker } from '@/app/actions/brokers'
import { useDraftStore } from '@/stores/draft-store'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { PAYMENT_TERMS_OPTIONS, PAYMENT_TERMS_LABELS } from '@/types'
import type { Broker } from '@/types/database'

interface BrokerFormProps {
  broker?: Broker
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'broker-new'

function mapBrokerToFormValues(broker: Broker): BrokerFormValues {
  return {
    name: broker.name,
    email: broker.email ?? '',
    phone: broker.phone ?? '',
    address: broker.address ?? '',
    city: broker.city ?? '',
    state: broker.state ?? '',
    zip: broker.zip ?? '',
    paymentTerms: broker.payment_terms ?? undefined,
    factoringCompany: broker.factoring_company ?? '',
    notes: broker.notes ?? '',
  }
}

export function BrokerForm({ broker, onSuccess, onCancel }: BrokerFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const isEditMode = !!broker

  // Load draft for create mode, or use broker data for edit mode
  const getDefaultValues = (): BrokerFormValues => {
    if (isEditMode) {
      return mapBrokerToFormValues(broker)
    }
    const draft = loadDraft(DRAFT_KEY)
    if (draft) {
      const { _savedAt, ...draftValues } = draft
      return draftValues as unknown as BrokerFormValues
    }
    return {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      paymentTerms: undefined,
      factoringCompany: '',
      notes: '',
    }
  }

  const form = useForm<BrokerFormValues>({
    resolver: zodResolver(brokerSchema),
    defaultValues: getDefaultValues(),
  })

  // Draft auto-save for create mode only
  const watchedRef = useRef(false)
  useEffect(() => {
    if (isEditMode) return
    // Skip first render to avoid saving initial values as draft
    if (!watchedRef.current) {
      watchedRef.current = true
    }
    const subscription = form.watch((values) => {
      if (watchedRef.current) {
        saveDraft(DRAFT_KEY, values as Record<string, unknown>)
      }
    })
    return () => subscription.unsubscribe()
  }, [form, isEditMode, saveDraft])

  const onSubmit = async (values: BrokerFormValues) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEditMode
        ? await updateBroker(broker.id, values)
        : await createBroker(values)

      if ('error' in result && result.error) {
        if (typeof result.error === 'string') {
          setServerError(result.error)
        } else {
          // Field errors from Zod
          Object.entries(result.error).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              form.setError(field as keyof BrokerFormValues, {
                message: messages[0],
              })
            }
          })
        }
        return
      }

      // Success
      if (!isEditMode) {
        clearDraft(DRAFT_KEY)
      }
      queryClient.invalidateQueries({ queryKey: ['brokers'] })
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ['broker', broker.id] })
      }
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        key={broker?.id ?? 'create'}
      >
        {serverError && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Broker company name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="contact@broker.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="(555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Main St" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="City" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder="CA" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ZIP</FormLabel>
                <FormControl>
                  <Input placeholder="90210" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select terms" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((term) => (
                      <SelectItem key={term} value={term}>
                        {PAYMENT_TERMS_LABELS[term]}
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
            name="factoringCompany"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Factoring Company</FormLabel>
                <FormControl>
                  <Input placeholder="Factoring company name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional notes about this broker..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEditMode
                ? 'Saving...'
                : 'Creating...'
              : isEditMode
                ? 'Save Changes'
                : 'Create Broker'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
