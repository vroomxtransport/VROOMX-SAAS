'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { driverSchema, type DriverFormValues, type DriverFormInput } from '@/lib/validations/driver'
import { createDriver, updateDriver, sendDriverAppInvitation } from '@/app/actions/drivers'
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
import { Checkbox } from '@/components/ui/checkbox'
import { useEffect, useState, useCallback } from 'react'
import { Smartphone, Check } from 'lucide-react'
import type { Driver } from '@/types/database'
import type { DriverPayType } from '@/types'

interface DriverFormProps {
  driver?: Driver
  onSuccess: () => void
  onCancel: () => void
}

const DRAFT_KEY = 'driver-new'

function getPayRateLabel(payType: DriverPayType): string {
  switch (payType) {
    case 'percentage_of_carrier_pay':
      return 'Cut %'
    case 'dispatch_fee_percent':
      return 'Fee %'
    case 'per_mile':
      return 'Rate per mile $'
    default:
      return 'Pay Rate'
  }
}

export function DriverForm({ driver, onSuccess, onCancel }: DriverFormProps) {
  const isEdit = !!driver
  const { saveDraft, loadDraft, clearDraft } = useDraftStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [sendInvite, setSendInvite] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const defaultValues: DriverFormInput = driver
    ? {
        firstName: driver.first_name,
        lastName: driver.last_name,
        email: driver.email ?? '',
        phone: driver.phone ?? '',
        address: driver.address ?? '',
        city: driver.city ?? '',
        state: driver.state ?? '',
        zip: driver.zip ?? '',
        licenseNumber: driver.license_number ?? '',
        driverType: driver.driver_type as 'company' | 'owner_operator',
        driverStatus: driver.driver_status as 'active' | 'inactive',
        payType: driver.pay_type as DriverPayType,
        payRate: parseFloat(driver.pay_rate),
        notes: driver.notes ?? '',
      }
    : {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        licenseNumber: '',
        driverType: 'company' as const,
        driverStatus: 'active' as const,
        payType: 'percentage_of_carrier_pay' as const,
        payRate: 0,
        notes: '',
      }

  // Load draft for create mode
  const draft = !isEdit ? loadDraft(DRAFT_KEY) : null

  const form = useForm<DriverFormInput>({
    resolver: zodResolver(driverSchema),
    defaultValues: draft
      ? {
          ...defaultValues,
          ...(draft as Partial<DriverFormInput>),
        }
      : defaultValues,
  })

  const watchedPayType = (form.watch('payType') ?? 'percentage_of_carrier_pay') as DriverPayType
  const watchedEmail = form.watch('email')

  // Auto-save draft for create mode
  const formValues = form.watch()
  const saveDraftCallback = useCallback(
    (values: DriverFormInput) => {
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

  const onSubmit = async (values: DriverFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateDriver(driver.id, values)
        : await createDriver(values)

      if ('error' in result && result.error) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Validation failed. Please check the form.'
        setServerError(errorMessage)
        return
      }

      // Send app invitation for new driver if checkbox was checked
      if (!isEdit && sendInvite && 'data' in result && result.data) {
        await sendDriverAppInvitation(result.data.id).catch(() => {})
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
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Personal Info */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Personal Info</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} />
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
        </div>

        {/* Address */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Address</h4>
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="city"
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
              name="state"
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
            <FormField
              control={form.control}
              name="zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP</FormLabel>
                  <FormControl>
                    <Input placeholder="33101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Driver Details */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Driver Details</h4>
          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License Number</FormLabel>
                <FormControl>
                  <Input placeholder="DL-123456" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="driverType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="owner_operator">Owner Operator</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="driverStatus"
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
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pay Configuration */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-900">Pay Configuration</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="payType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage_of_carrier_pay">% of Carrier Pay</SelectItem>
                      <SelectItem value="dispatch_fee_percent">Dispatch Fee %</SelectItem>
                      <SelectItem value="per_mile">Per Mile</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{getPayRateLabel(watchedPayType)}</FormLabel>
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
                  placeholder="Additional notes about this driver..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* App Invitation */}
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <h4 className="mb-2 text-sm font-medium text-gray-900 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            Driver App Invitation
          </h4>
          {isEdit ? (
            // Edit mode: direct send button
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {driver.email
                  ? `Send a download link to ${driver.email}`
                  : 'Add an email address to send an app invitation'}
              </p>
              {inviteStatus === 'sent' && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  Invitation sent successfully
                </div>
              )}
              {inviteStatus === 'error' && inviteError && (
                <p className="text-xs text-red-600">{inviteError}</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!driver.email || inviteStatus === 'sending'}
                onClick={async () => {
                  setInviteStatus('sending')
                  setInviteError(null)
                  const result = await sendDriverAppInvitation(driver.id)
                  if ('error' in result && result.error) {
                    setInviteStatus('error')
                    setInviteError(typeof result.error === 'string' ? result.error : 'Failed to send')
                  } else {
                    setInviteStatus('sent')
                  }
                }}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                {inviteStatus === 'sending' ? 'Sending...' : 'Send App Invitation'}
              </Button>
            </div>
          ) : (
            // Create mode: checkbox
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sendInvite}
                onCheckedChange={(checked) => setSendInvite(checked === true)}
                disabled={!watchedEmail}
              />
              <span className={`text-sm ${watchedEmail ? 'text-foreground' : 'text-muted-foreground'}`}>
                Send app invitation after creating
              </span>
            </label>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Driver' : 'Create Driver'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
