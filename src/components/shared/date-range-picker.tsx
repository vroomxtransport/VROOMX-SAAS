'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Calendar } from '@/components/ui/calendar'
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
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
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
    setPopoverOpen(false)
    onChange(preset.getValue())
  }

  const handleOpenCustom = () => {
    setPopoverOpen(false)
    setCustomFrom(value ? new Date(value.from) : undefined)
    setCustomTo(value ? new Date(value.to) : undefined)
    setCalendarOpen(true)
  }

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom.toISOString(), to: customTo.toISOString() })
    }
    setCalendarOpen(false)
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <HugeiconsIcon icon={Calendar03Icon} size={14} />
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
                <HugeiconsIcon icon={Cancel01Icon} size={12} />
              </button>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
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
              className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left font-medium"
              onClick={handleOpenCustom}
            >
              Custom Range...
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6 pt-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">From</p>
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                disabled={(date) => (customTo ? date > customTo : false)}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">To</p>
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                disabled={(date) => (customFrom ? date < customFrom : false)}
              />
            </div>
          </div>
          {customFrom && customTo && (
            <p className="text-center text-sm text-muted-foreground">
              {customFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' – '}
              {customTo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApplyCustom}
              disabled={!customFrom || !customTo}
              className="bg-brand text-white hover:bg-brand/90"
            >
              Apply Range
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
