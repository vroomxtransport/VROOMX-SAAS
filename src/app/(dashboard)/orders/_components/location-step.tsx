'use client'

import { useFormContext } from 'react-hook-form'
import { useAddressSearch, type AddressSuggestion } from '@/hooks/use-address-autocomplete'
import { useState, useRef, useEffect } from 'react'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MapPin, Loader2 } from 'lucide-react'
import type { CreateOrderInput } from '@/lib/validations/order'

function AddressInput({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (s: AddressSuggestion) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { suggestions, isLoading } = useAddressSearch(query)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || isLoading) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s)
                setOpen(false)
              }}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{s.location || s.city}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[s.city, s.state, s.zip].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    form.setValue(locationField, suggestion.location || suggestion.displayName)
    if (suggestion.city) form.setValue(cityField, suggestion.city)
    if (suggestion.state) form.setValue(stateField, suggestion.state)
    if (suggestion.zip) form.setValue(zipField, suggestion.zip)
  }

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
              <AddressInput
                value={field.value as string ?? ''}
                onChange={field.onChange}
                onSelect={handleAddressSelect}
                placeholder="Start typing an address..."
              />
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
