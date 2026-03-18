'use client'

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { DateRange } from '@/types/filters'
import { startOfMonth, startOfQuarter, startOfYear, subDays, format, isSameDay } from 'date-fns'

type FinancialPreset = 'mtd' | 'qtd' | 'ytd' | 'last30' | 'last90'

const PRESETS: { key: FinancialPreset; label: string }[] = [
  { key: 'mtd', label: 'MTD' },
  { key: 'qtd', label: 'QTD' },
  { key: 'ytd', label: 'YTD' },
  { key: 'last30', label: '30d' },
  { key: 'last90', label: '90d' },
]

function getPresetStart(preset: FinancialPreset): Date {
  const now = new Date()
  switch (preset) {
    case 'mtd': return startOfMonth(now)
    case 'qtd': return startOfQuarter(now)
    case 'ytd': return startOfYear(now)
    case 'last30': return subDays(now, 30)
    case 'last90': return subDays(now, 90)
  }
}

function presetToDateRange(preset: FinancialPreset): DateRange {
  const start = getPresetStart(preset)
  return { from: start.toISOString(), to: new Date().toISOString() }
}

function detectActivePreset(dateRange: DateRange | undefined): FinancialPreset | null {
  if (!dateRange) return 'mtd' // default
  const from = new Date(dateRange.from)
  for (const p of PRESETS) {
    if (isSameDay(from, getPresetStart(p.key))) return p.key
  }
  return null
}

interface PeriodSelectorProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState<Date | undefined>(
    value ? new Date(value.from) : undefined
  )
  const [customTo, setCustomTo] = useState<Date | undefined>(
    value ? new Date(value.to) : undefined
  )

  const activePreset = useMemo(() => detectActivePreset(value), [value])
  const isCustomActive = activePreset === null

  const handlePresetClick = (preset: FinancialPreset) => {
    setShowCustom(false)
    onChange(presetToDateRange(preset))
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

  const formatDate = (iso: string) =>
    format(new Date(iso), 'MMM d, yyyy')

  return (
    <div className="space-y-3">
      {/* Preset pills + Custom button */}
      <div className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-muted/50 p-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            onClick={() => handlePresetClick(preset.key)}
            className={cn(
              'relative z-10 h-8 rounded-lg px-3 text-xs font-medium transition-colors',
              activePreset === preset.key
                ? 'text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {activePreset === preset.key && (
              <motion.span
                layoutId="fin-period"
                className="absolute inset-0 rounded-lg bg-brand"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative">{preset.label}</span>
          </button>
        ))}

        {/* Custom toggle */}
        <Popover open={showCustom} onOpenChange={setShowCustom}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'relative z-10 flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
                isCustomActive
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isCustomActive && (
                <motion.span
                  layoutId="fin-period"
                  className="absolute inset-0 rounded-lg bg-brand"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {isCustomActive && value
                  ? `${format(new Date(value.from), 'MMM d')} - ${format(new Date(value.to), 'MMM d')}`
                  : 'Custom'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="flex gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={customFrom}
                  onSelect={handleCustomFromSelect}
                  disabled={(date) => (customTo ? date > customTo : false)}
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">To</p>
                <Calendar
                  mode="single"
                  selected={customTo}
                  onSelect={handleCustomToSelect}
                  disabled={(date) => (customFrom ? date < customFrom : false)}
                />
              </div>
            </div>
            {customFrom && customTo && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {formatDate(customFrom.toISOString())} - {formatDate(customTo.toISOString())}
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
