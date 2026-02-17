'use client'

import { useFormContext } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { CreateOrderInput } from '@/lib/validations/order'

function LocationSection({
  prefix,
  label,
}: {
  prefix: 'pickup' | 'delivery'
  label: string
}) {
  const form = useFormContext<CreateOrderInput>()

  const locationField = `${prefix}Location` as keyof CreateOrderInput
  const cityField = `${prefix}City` as keyof CreateOrderInput
  const stateField = `${prefix}State` as keyof CreateOrderInput
  const zipField = `${prefix}Zip` as keyof CreateOrderInput
  const contactNameField = `${prefix}ContactName` as keyof CreateOrderInput
  const contactPhoneField = `${prefix}ContactPhone` as keyof CreateOrderInput
  const dateField = `${prefix}Date` as keyof CreateOrderInput

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{label}</h4>

      <FormField
        control={form.control}
        name={locationField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address *</FormLabel>
            <FormControl>
              <Input placeholder="123 Main St" {...field} value={field.value as string ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-3">
        <FormField
          control={form.control}
          name={cityField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>City *</FormLabel>
              <FormControl>
                <Input placeholder="Miami" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={stateField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>State *</FormLabel>
              <FormControl>
                <Input placeholder="FL" maxLength={2} {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={zipField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>ZIP</FormLabel>
              <FormControl>
                <Input placeholder="33101" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name={contactNameField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={contactPhoneField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Phone</FormLabel>
              <FormControl>
                <Input placeholder="(555) 123-4567" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={dateField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} value={field.value as string ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

export function LocationStep() {
  return (
    <div className="space-y-6">
      <LocationSection prefix="pickup" label="Pickup Location" />
      <div className="border-t border-border" />
      <LocationSection prefix="delivery" label="Delivery Location" />
    </div>
  )
}
