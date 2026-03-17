'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { DateRange, DatePreset } from '@/types/filters'
import { getDatePresets } from '@/types/filters'

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  presets?: DatePreset[]
  placeholder?: string
}

export function DateRangePicker({
  value,
  onChange,
  presets,
  placeholder = 'Select dates',
}: DateRangePickerProps) {
  const datePresets = presets ?? getDatePresets()
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState<Date | undefined>(
    value ? new Date(value.from) : undefined
  )
  const [customTo, setCustomTo] = useState<Date | undefined>(
    value ? new Date(value.to) : undefined
  )

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const handlePreset = (preset: DatePreset) => {
    setShowCustom(false)
    onChange(preset.getValue())
  }

  const handleCustomFromSelect = (date: Date | undefined) => {
    setCustomFrom(date)
    if (date && customTo && date <= customTo) {
      onChange({ from: date.toISOString(), to: customTo.toISOString() })
    }
  }

  const handleCustomToSelect = (date: Date | undefined) => {
    setCustomTo(date)
    if (date && customFrom && customFrom <= date) {
      onChange({ from: customFrom.toISOString(), to: date.toISOString() })
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {value ? (
            <span className="text-xs">
              {formatDate(value.from)} – {formatDate(value.to)}
            </span>
          ) : (
            placeholder
          )}
          {value && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange(undefined)
                setCustomFrom(undefined)
                setCustomTo(undefined)
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        {/* Presets */}
        <div className="space-y-1">
          {datePresets.map((preset) => (
            <button
              key={preset.label}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
              onClick={() => handlePreset(preset)}
            >
              {preset.label}
            </button>
          ))}
          <button
            className={cn(
              'flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left font-medium',
              showCustom && 'bg-muted'
            )}
            onClick={() => setShowCustom(!showCustom)}
          >
            Custom Range...
          </button>
        </div>

        {/* Custom calendar pickers */}
        {showCustom && (
          <div className="mt-3 border-t border-border-subtle pt-3">
            <div className="flex gap-4">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={handleCustomFromSelect}
                  disabled={(date) => (customTo ? date > customTo : false)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">To</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={handleCustomToSelect}
                  disabled={(date) => (customFrom ? date < customFrom : false)}
                />
              </div>
            </div>
            {customFrom && customTo && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {customFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' – '}
                {customTo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
