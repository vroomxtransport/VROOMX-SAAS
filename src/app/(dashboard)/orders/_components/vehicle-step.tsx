'use client'

import { useFormContext } from 'react-hook-form'
import { useVinDecode } from '@/hooks/use-vin-decode'
import { useEffect } from 'react'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { CreateOrderInput } from '@/lib/validations/order'

export function VehicleStep() {
  const form = useFormContext<CreateOrderInput>()
  const vin = form.watch('vehicleVin') ?? ''
  const { data: vinData, isPending: isDecoding, isError, error } = useVinDecode(vin)

  // Auto-fill fields when VIN decode succeeds
  useEffect(() => {
    if (vinData && vinData.errorCode === '0') {
      if (vinData.year) form.setValue('vehicleYear', parseInt(vinData.year, 10))
      if (vinData.make) form.setValue('vehicleMake', vinData.make)
      if (vinData.model) form.setValue('vehicleModel', vinData.model)
      if (vinData.vehicleType) form.setValue('vehicleType', vinData.vehicleType)
    }
  }, [vinData, form])

  return (
    <div className="space-y-4">
      {/* VIN Input with decode status */}
      <FormField
        control={form.control}
        name="vehicleVin"
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
              {/* Decode status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {vin.length === 17 && isDecoding && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
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
              <p className="text-xs text-gray-500">
                {vin.length}/17 characters
              </p>
            )}
            {vin.length === 17 && vinData && vinData.errorCode !== '0' && (
              <p className="text-xs text-amber-600">
                VIN decode returned warnings. Please verify fields manually.
              </p>
            )}
            {vin.length === 17 && isError && (
              <p className="text-xs text-red-600">
                {error instanceof Error ? error.message : 'VIN decode failed'}
              </p>
            )}
          </FormItem>
        )}
      />

      {/* Year, Make, Model - always visible for manual entry */}
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="vehicleYear"
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
          name="vehicleMake"
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
          name="vehicleModel"
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

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="vehicleType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vehicle Type</FormLabel>
              <FormControl>
                <Input
                  placeholder="Sedan, SUV, Truck, etc."
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vehicleColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <Input
                  placeholder="White, Black, Silver..."
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
