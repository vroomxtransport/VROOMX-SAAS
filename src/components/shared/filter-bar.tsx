'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterConfig {
  key: string
  label: string
  type: 'select' | 'search'
  options?: FilterOption[]
  placeholder?: string
}

interface FilterBarProps {
  filters: FilterConfig[]
  onFilterChange: (key: string, value: string | undefined) => void
  activeFilters: Record<string, string>
}

export function FilterBar({ filters, onFilterChange, activeFilters }: FilterBarProps) {
  const hasActiveFilters = Object.values(activeFilters).some((v) => v !== undefined && v !== '')

  const clearAllFilters = () => {
    filters.forEach((filter) => {
      onFilterChange(filter.key, undefined)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <Input
              key={filter.key}
              placeholder={filter.placeholder ?? `Search...`}
              value={activeFilters[filter.key] ?? ''}
              onChange={(e) =>
                onFilterChange(filter.key, e.target.value || undefined)
              }
              className="h-9 w-[200px]"
            />
          )
        }

        if (filter.type === 'select' && filter.options) {
          return (
            <Select
              key={filter.key}
              value={activeFilters[filter.key] ?? ''}
              onValueChange={(value) =>
                onFilterChange(filter.key, value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }

        return null
      })}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-9 px-2 text-gray-500 hover:text-gray-700"
        >
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  )
}
