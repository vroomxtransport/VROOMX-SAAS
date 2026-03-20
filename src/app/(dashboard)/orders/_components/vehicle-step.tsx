'use client'

import { useFormContext, useFieldArray } from 'react-hook-form'
import { useVinDecode } from '@/hooks/use-vin-decode'
import { decodeVin } from '@/lib/vin-decoder'
import { useVehicleMakes, useVehicleModels, getVehicleType } from '@/hooks/use-vehicle-autocomplete'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Car, ChevronDown, ChevronUp, ClipboardPaste } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CreateOrderInput } from '@/lib/validations/order'

const MAX_VEHICLES = 10

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
  suggestions: string[]
  isLoading?: boolean
  placeholder?: string
  disabled?: boolean
}

function AutocompleteInput({ value, onChange, onSelect, suggestions, isLoading, placeholder, disabled }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

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
          setOpen(true)
        }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-surface shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors truncate"
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(s)
                setOpen(false)
              }}
            >
              {s}
            </button>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VehicleEntry({ index, onRemove, canRemove }: { index: number; onRemove: () => void; canRemove: boolean }) {
  const form = useFormContext<CreateOrderInput>()
  const [expanded, setExpanded] = useState(index === 0)
  const vin = form.watch(`vehicles.${index}.vin`) ?? ''
  const make = form.watch(`vehicles.${index}.make`) ?? ''
  const model = form.watch(`vehicles.${index}.model`) ?? ''
  const year = form.watch(`vehicles.${index}.year`)
  const { data: vinData, isPending: isDecoding, isError, error } = useVinDecode(vin)

  // Make/model autocomplete
  const { makes: makeSuggestions } = useVehicleMakes(make)
  const { models: modelSuggestions } = useVehicleModels(make, model)

  // Auto-fill fields when VIN decode succeeds
  useEffect(() => {
    if (vinData && vinData.errorCode === '0') {
      if (vinData.year) form.setValue(`vehicles.${index}.year`, parseInt(vinData.year, 10))
      if (vinData.make) form.setValue(`vehicles.${index}.make`, vinData.make)
      if (vinData.model) form.setValue(`vehicles.${index}.model`, vinData.model)
      if (vinData.vehicleType) form.setValue(`vehicles.${index}.type`, vinData.vehicleType)
    }
  }, [vinData, form, index])

  // Auto-set vehicle type when model changes (manual entry)
  const handleModelSelect = (selectedModel: string) => {
    form.setValue(`vehicles.${index}.model`, selectedModel)
    const vehicleType = getVehicleType(selectedModel)
    if (vehicleType) {
      form.setValue(`vehicles.${index}.type`, vehicleType)
    }
  }

  const summary = make && model
    ? `${year || ''} ${make} ${model}`.trim()
    : `Vehicle ${index + 1}`

  return (
    <div className="rounded-lg border border-border-subtle bg-surface/50">
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

          {/* Year, Make (autocomplete), Model (autocomplete) */}
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
                    <AutocompleteInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onSelect={field.onChange}
                      suggestions={makeSuggestions.map((m) => m.name)}
                      placeholder="Toyota"
                    />
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
                    <AutocompleteInput
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onSelect={handleModelSelect}
                      suggestions={modelSuggestions}
                      placeholder="Camry"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Type (auto-filled), Color */}
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkVins, setBulkVins] = useState('')
  const [bulkDecoding, setBulkDecoding] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const handleBulkDecode = useCallback(async () => {
    const vins = bulkVins
      .split(/[\n,]+/)
      .map((v) => v.trim().toUpperCase())
      .filter((v) => v.length === 17)

    if (vins.length === 0) return

    const remaining = MAX_VEHICLES - fields.length
    const toProcess = vins.slice(0, remaining)

    setBulkDecoding(true)
    for (let i = 0; i < toProcess.length; i++) {
      setBulkProgress(`Decoding ${i + 1}/${toProcess.length}...`)
      try {
        const result = await decodeVin(toProcess[i])
        append({
          vin: toProcess[i],
          year: result.year ? parseInt(result.year, 10) : new Date().getFullYear(),
          make: result.make || '',
          model: result.model || '',
          type: result.vehicleType || getVehicleType(result.model || ''),
          color: '',
        })
      } catch {
        // Still add with just the VIN if decode fails
        append({
          vin: toProcess[i],
          year: new Date().getFullYear(),
          make: '',
          model: '',
          type: '',
          color: '',
        })
      }
    }
    setBulkDecoding(false)
    setBulkProgress('')
    setBulkVins('')
    setBulkOpen(false)
  }, [bulkVins, fields.length, append])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {fields.length}/{MAX_VEHICLES} vehicles
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={fields.length >= MAX_VEHICLES}
            className="gap-1.5"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste VINs
          </Button>
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
      </div>

      {/* Bulk VIN Decode Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste VINs</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Paste VINs here — one per line or comma-separated"
              value={bulkVins}
              onChange={(e) => setBulkVins(e.target.value)}
              rows={5}
              disabled={bulkDecoding}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {bulkVins.split(/[\n,]+/).filter((v) => v.trim().length === 17).length} valid VINs detected
              {fields.length > 0 && ` (${MAX_VEHICLES - fields.length} slots remaining)`}
            </p>
            {bulkProgress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {bulkProgress}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkDecoding}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkDecode}
              disabled={bulkDecoding || bulkVins.split(/[\n,]+/).filter((v) => v.trim().length === 17).length === 0}
            >
              {bulkDecoding ? 'Decoding...' : 'Decode & Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
