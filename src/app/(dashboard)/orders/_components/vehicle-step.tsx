'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { useVinDecode } from '@/hooks/use-vin-decode'
import { useEffect, useState } from 'react'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Car, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreateOrderInput } from '@/lib/validations/order'

const MAX_VEHICLES = 10

function VehicleEntry({ index, onRemove, canRemove }: { index: number; onRemove: () => void; canRemove: boolean }) {
  const form = useFormContext<CreateOrderInput>()
  const [expanded, setExpanded] = useState(index === 0)
  const vin = form.watch(`vehicles.${index}.vin`) ?? ''
  const make = form.watch(`vehicles.${index}.make`) ?? ''
  const model = form.watch(`vehicles.${index}.model`) ?? ''
  const year = form.watch(`vehicles.${index}.year`)
  const { data: vinData, isPending: isDecoding, isError, error } = useVinDecode(vin)

  // Auto-fill fields when VIN decode succeeds
  useEffect(() => {
    if (vinData && vinData.errorCode === '0') {
      if (vinData.year) form.setValue(`vehicles.${index}.year`, parseInt(vinData.year, 10))
      if (vinData.make) form.setValue(`vehicles.${index}.make`, vinData.make)
      if (vinData.model) form.setValue(`vehicles.${index}.model`, vinData.model)
      if (vinData.vehicleType) form.setValue(`vehicles.${index}.type`, vinData.vehicleType)
    }
  }, [vinData, form, index])

  const summary = make && model
    ? `${year || ''} ${make} ${model}`.trim()
    : `Vehicle ${index + 1}`

  return (
    <div className="rounded-lg border border-border-subtle bg-surface/50">
      {/* Collapsible header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Car className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{summary}</span>
          <span className="text-xs text-muted-foreground">#{index + 1}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          )}
        </button>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive shrink-0"
            aria-label={`Remove vehicle ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Expanded form fields */}
      {expanded && (
        <div className="space-y-4 px-3 pb-3 border-t border-border-subtle pt-3">
          {/* VIN Input with decode status */}
          <FormField
            control={form.control}
            name={`vehicles.${index}.vin`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>VIN</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      placeholder="Enter 17-character VIN"
                      maxLength={17}
                      {...field}
                      value={field.value ?? ''}
                      className="pr-10"
                    />
                  </FormControl>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {vin.length === 17 && isDecoding && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                    )}
                    {vin.length === 17 && vinData && vinData.errorCode === '0' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {vin.length === 17 && isError && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                <FormMessage />
                {vin.length > 0 && vin.length < 17 && (
                  <p className="text-xs text-muted-foreground">{vin.length}/17 characters</p>
                )}
                {vin.length === 17 && vinData && vinData.errorCode !== '0' && (
                  <p className="text-xs text-amber-600">VIN decode returned warnings. Verify fields manually.</p>
                )}
                {vin.length === 17 && isError && (
                  <p className="text-xs text-red-600">
                    {error instanceof Error ? error.message : 'VIN decode failed'}
                  </p>
                )}
              </FormItem>
            )}
          />

          {/* Year, Make, Model */}
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name={`vehicles.${index}.year`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="2024"
                      {...field}
                      value={field.value as number ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : '')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`vehicles.${index}.make`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Make *</FormLabel>
                  <FormControl>
                    <Input placeholder="Toyota" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`vehicles.${index}.model`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model *</FormLabel>
                  <FormControl>
                    <Input placeholder="Camry" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Type, Color */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name={`vehicles.${index}.type`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Type</FormLabel>
                  <FormControl>
                    <Input placeholder="Sedan, SUV, Truck..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`vehicles.${index}.color`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input placeholder="White, Black, Silver..." {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function VehicleStep() {
  const form = useFormContext<CreateOrderInput>()
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'vehicles',
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {fields.length}/{MAX_VEHICLES} vehicles
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({
            vin: '',
            year: new Date().getFullYear(),
            make: '',
            model: '',
            type: '',
            color: '',
          })}
          disabled={fields.length >= MAX_VEHICLES}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Vehicle
        </Button>
      </div>

      {fields.map((field, index) => (
        <VehicleEntry
          key={field.id}
          index={index}
          onRemove={() => remove(index)}
          canRemove={fields.length > 1}
        />
      ))}

      {form.formState.errors.vehicles?.message && (
        <p className="text-sm text-destructive">{form.formState.errors.vehicles.message}</p>
      )}
    </div>
  )
}
