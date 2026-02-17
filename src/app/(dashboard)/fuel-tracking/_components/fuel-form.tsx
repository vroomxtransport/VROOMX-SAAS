'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fuelSchema, type FuelFormValues, type FuelFormInput } from '@/lib/validations/fuel'
import { createFuelEntry, updateFuelEntry } from '@/app/actions/fuel'
import { useDrivers } from '@/hooks/use-drivers'
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
import { useState } from 'react'
import type { FuelEntry } from '@/types/database'

interface FuelFormProps {
  entry?: FuelEntry
  onSuccess: () => void
  onCancel: () => void
}

export function FuelForm({ entry, onSuccess, onCancel }: FuelFormProps) {
  const isEdit = !!entry
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: driversData } = useDrivers({ pageSize: 100 })
  const { data: trucksData } = useTrucks({ pageSize: 100 })

  const drivers = driversData?.drivers ?? []
  const trucks = trucksData?.trucks ?? []

  const defaultValues: FuelFormInput = entry
    ? {
        truckId: entry.truck_id ?? '',
        driverId: entry.driver_id ?? '',
        date: entry.date,
        gallons: parseFloat(entry.gallons) || 0,
        costPerGallon: parseFloat(entry.cost_per_gallon) || 0,
        odometer: entry.odometer ?? undefined,
        location: entry.location ?? '',
        state: entry.state ?? '',
        notes: entry.notes ?? '',
      }
    : {
        truckId: '',
        driverId: '',
        date: new Date().toISOString().split('T')[0],
        gallons: 0,
        costPerGallon: 0,
        odometer: undefined,
        location: '',
        state: '',
        notes: '',
      }

  const form = useForm<FuelFormInput>({
    resolver: zodResolver(fuelSchema),
    defaultValues,
  })

  const onSubmit = async (values: FuelFormInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = isEdit
        ? await updateFuelEntry(entry.id, values)
        : await createFuelEntry(values)

      if ('error' in result && result.error) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : 'Validation failed. Please check the form.'
        setServerError(errorMessage)
        return
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

        {/* Truck & Driver */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Assignment</h4>
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
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.first_name} {driver.last_name}
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

        {/* Date & Fuel Info */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Fuel Details</h4>
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="gallons"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gallons *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={typeof field.value === 'number' ? field.value : ''}
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
            <FormField
              control={form.control}
              name="costPerGallon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Gallon *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={typeof field.value === 'number' ? field.value : ''}
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
          <div className="mt-3">
            <FormField
              control={form.control}
              name="odometer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Odometer Reading</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Current mileage"
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
          </div>
        </div>

        {/* Location */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">Location</h4>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Station name or address" {...field} />
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
                  placeholder="Additional notes about this fuel purchase..."
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
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Entry' : 'Add Entry'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
