'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { tripSchema, type TripInput } from '@/lib/validations/trip'
import { createTrip } from '@/app/actions/trips'
import { useDrivers } from '@/hooks/use-drivers'
import { useTrucks } from '@/hooks/use-trucks'
import { TRUCK_TYPE_LABELS } from '@/types'
import type { TruckType } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react'

interface NewTripDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Searchable combobox for selecting from a list
function SearchableSelect({
  label,
  placeholder,
  searchPlaceholder,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  placeholder: string
  searchPlaceholder: string
  options: { value: string; label: string; sublabel?: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredOptions = useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(lower) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(lower))
    )
  }, [options, search])

  const selectedOption = options.find((o) => o.value === value)

  // Focus the search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearch('')
    }
  }, [open])

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              error && 'border-red-500'
            )}
          >
            {selectedOption ? (
              <span className="truncate">
                {selectedOption.label}
                {selectedOption.sublabel && (
                  <span className="ml-1 text-muted-foreground">| {selectedOption.sublabel}</span>
                )}
              </span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="p-2">
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-3 text-center text-sm text-muted-foreground">
                No results found.
              </p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100',
                    value === option.value && 'bg-gray-50'
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">
                    {option.label}
                    {option.sublabel && (
                      <span className="ml-1 text-muted-foreground">| {option.sublabel}</span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}

export function NewTripDialog({ open, onOpenChange }: NewTripDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: driversData } = useDrivers({ status: 'active', pageSize: 200 })
  const { data: trucksData } = useTrucks({ status: 'active', pageSize: 200 })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TripInput>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      driver_id: '',
      truck_id: '',
      start_date: '',
      end_date: '',
      carrier_pay: 0,
      notes: '',
    },
  })

  const truckId = watch('truck_id')
  const driverId = watch('driver_id')

  const truckOptions = useMemo(
    () =>
      (trucksData?.trucks ?? []).map((t) => ({
        value: t.id,
        label: t.unit_number,
        sublabel: TRUCK_TYPE_LABELS[t.truck_type as TruckType] ?? t.truck_type,
      })),
    [trucksData]
  )

  const driverOptions = useMemo(
    () =>
      (driversData?.drivers ?? []).map((d) => ({
        value: d.id,
        label: `${d.first_name} ${d.last_name}`,
        sublabel: d.driver_type === 'company' ? 'Company' : 'Owner Operator',
      })),
    [driversData]
  )

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        driver_id: '',
        truck_id: '',
        start_date: '',
        end_date: '',
        carrier_pay: 0,
        notes: '',
      })
      setServerError(null)
    }
  }, [open, reset])

  const onSubmit = async (formData: TripInput) => {
    setIsSubmitting(true)
    setServerError(null)

    try {
      const result = await createTrip(formData)

      if (result.error) {
        if (typeof result.error === 'string') {
          setServerError(result.error)
        } else {
          // Field-level errors from Zod
          setServerError('Please check the form fields and try again.')
        }
        return
      }

      if (result.success && result.tripId) {
        onOpenChange(false)
        router.push(`/trips/${result.tripId}`)
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Trip</DialogTitle>
          <DialogDescription>
            Set up a new trip by selecting a truck, driver, and date range. Orders can be added from the trip detail page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          {/* Truck (searchable) */}
          <SearchableSelect
            label="Truck"
            placeholder="Select a truck..."
            searchPlaceholder="Search by unit number..."
            options={truckOptions}
            value={truckId}
            onChange={(v) => setValue('truck_id', v, { shouldValidate: true })}
            error={errors.truck_id?.message}
          />

          {/* Driver (searchable) */}
          <SearchableSelect
            label="Driver"
            placeholder="Select a driver..."
            searchPlaceholder="Search by name..."
            options={driverOptions}
            value={driverId}
            onChange={(v) => setValue('driver_id', v, { shouldValidate: true })}
            error={errors.driver_id?.message}
          />

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
                className={cn(errors.start_date && 'border-red-500')}
              />
              {errors.start_date && (
                <p className="text-sm text-red-500">{errors.start_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
                className={cn(errors.end_date && 'border-red-500')}
              />
              {errors.end_date && (
                <p className="text-sm text-red-500">{errors.end_date.message}</p>
              )}
            </div>
          </div>

          {/* Carrier Pay */}
          <div className="space-y-2">
            <Label htmlFor="carrier_pay">Carrier Pay (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                $
              </span>
              <Input
                id="carrier_pay"
                type="number"
                step="0.01"
                min="0"
                {...register('carrier_pay')}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
            {errors.carrier_pay && (
              <p className="text-sm text-red-500">{errors.carrier_pay.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Add any trip notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Trip'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
