'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { X, Search, SlidersHorizontal, ChevronDown, Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { EnhancedFilterConfig, FilterOption, DateRange, DatePreset } from '@/types/filters'
import { getDatePresets } from '@/types/filters'

// ── Debounced Search ──────────────────────────────────────────────────────────
function DebouncedSearch({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string | undefined) => void
}) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleChange = (v: string) => {
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v || undefined), 300)
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 w-[220px] pl-8"
      />
      {local && (
        <button
          onClick={() => {
            setLocal('')
            onChange(undefined)
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Status Pills ──────────────────────────────────────────────────────────────
function StatusPills({
  options,
  value,
  onChange,
}: {
  options: FilterOption[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange(undefined)}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium transition-all',
          !value
            ? 'bg-foreground text-background shadow-sm'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-all',
            value === opt.value
              ? cn('shadow-sm', opt.color || 'bg-brand text-white')
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1 opacity-70">{opt.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Multi-Select Popover ──────────────────────────────────────────────────────
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="space-y-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full h-7 text-xs"
            onClick={() => onChange([])}
          >
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Date Range Picker (presets in popover, custom calendar in dialog) ──────────
function DateRangeFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const presets = getDatePresets()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState<Date | undefined>(
    value ? new Date(value.from) : undefined
  )
  const [customTo, setCustomTo] = useState<Date | undefined>(
    value ? new Date(value.to) : undefined
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

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
            <CalendarIcon className="h-3.5 w-3.5" />
            {value ? (
              <span className="text-xs">
                {formatDate(value.from)} – {formatDate(value.to)}
              </span>
            ) : (
              label
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="start">
          <div className="space-y-1">
            {presets.map((preset) => (
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
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full h-7 text-xs"
              onClick={() => {
                onChange(undefined)
                setPopoverOpen(false)
              }}
            >
              Clear dates
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Custom date range dialog — separate from popover */}
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

// ── Main Enhanced Filter Bar ──────────────────────────────────────────────────
interface EnhancedFilterBarProps {
  filters: EnhancedFilterConfig[]
  activeFilters: Record<string, string | string[] | DateRange | undefined>
  onFilterChange: (key: string, value: string | string[] | DateRange | undefined) => void
  resultCount?: number
}

export function EnhancedFilterBar({
  filters,
  activeFilters,
  onFilterChange,
  resultCount,
}: EnhancedFilterBarProps) {
  // Count active filters (excluding search)
  const activeCount = Object.entries(activeFilters).filter(([key, val]) => {
    const config = filters.find((f) => f.key === key)
    if (!config || config.type === 'search') return false
    if (Array.isArray(val)) return val.length > 0
    return val !== undefined && val !== ''
  }).length

  const clearAll = () => {
    filters.forEach((f) => onFilterChange(f.key, undefined))
  }

  // Separate status pills (shown above) from other filters
  const statusPillFilter = filters.find((f) => f.type === 'status-pills')
  const otherFilters = filters.filter((f) => f.type !== 'status-pills')

  // Get applied filter chips for display
  const chips: { key: string; label: string; value: string }[] = []
  for (const f of filters) {
    const val = activeFilters[f.key]
    if (!val || f.type === 'search' || f.type === 'status-pills') continue

    if (f.type === 'date-range' && typeof val === 'object' && !Array.isArray(val)) {
      const dr = val as DateRange
      const from = new Date(dr.from).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const to = new Date(dr.to).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      chips.push({ key: f.key, label: f.label, value: `${from} – ${to}` })
    } else if (Array.isArray(val)) {
      val.forEach((v) => {
        const opt = f.options?.find((o) => o.value === v)
        chips.push({ key: f.key, label: f.label, value: opt?.label || v })
      })
    } else if (typeof val === 'string') {
      const opt = f.options?.find((o) => o.value === val)
      chips.push({ key: f.key, label: f.label, value: opt?.label || val })
    }
  }

  return (
    <div className="space-y-3">
      {/* Status pills row */}
      {statusPillFilter && statusPillFilter.options && (
        <StatusPills
          options={statusPillFilter.options}
          value={activeFilters[statusPillFilter.key] as string | undefined}
          onChange={(v) => onFilterChange(statusPillFilter.key, v)}
        />
      )}

      {/* Filter controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {otherFilters.map((filter) => {
          if (filter.type === 'search') {
            return (
              <DebouncedSearch
                key={filter.key}
                value={(activeFilters[filter.key] as string) ?? ''}
                placeholder={filter.placeholder ?? 'Search...'}
                onChange={(v) => onFilterChange(filter.key, v)}
              />
            )
          }

          if (filter.type === 'select' && filter.options) {
            return (
              <Select
                key={filter.key}
                value={(activeFilters[filter.key] as string) ?? ''}
                onValueChange={(v) =>
                  onFilterChange(filter.key, v === 'all' ? undefined : v)
                }
              >
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder={filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {filter.label}</SelectItem>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }

          if (filter.type === 'multi-select' && filter.options) {
            return (
              <MultiSelectFilter
                key={filter.key}
                label={filter.label}
                options={filter.options}
                selected={(activeFilters[filter.key] as string[]) ?? []}
                onChange={(v) =>
                  onFilterChange(filter.key, v.length > 0 ? v : undefined)
                }
              />
            )
          }

          if (filter.type === 'date-range') {
            return (
              <DateRangeFilter
                key={filter.key}
                label={filter.label}
                value={activeFilters[filter.key] as DateRange | undefined}
                onChange={(v) => onFilterChange(filter.key, v)}
              />
            )
          }

          return null
        })}

        {/* Active filter count + clear */}
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeCount} active
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Result count */}
        {resultCount !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">
            {resultCount.toLocaleString()} result{resultCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Applied filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip, i) => (
            <Badge
              key={`${chip.key}-${chip.value}-${i}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs font-normal"
            >
              <span className="text-muted-foreground">{chip.label}:</span>
              {chip.value}
              <button
                onClick={() => {
                  const filter = filters.find((f) => f.key === chip.key)
                  if (filter?.type === 'multi-select') {
                    const current = (activeFilters[chip.key] as string[]) ?? []
                    const opt = filter.options?.find((o) => o.label === chip.value)
                    onFilterChange(
                      chip.key,
                      current.filter((v) => v !== opt?.value)
                    )
                  } else {
                    onFilterChange(chip.key, undefined)
                  }
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
