'use client'

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortConfig } from '@/types/filters'

interface SortHeaderProps {
  label: string
  field: string
  currentSort: SortConfig | undefined
  onSort: (sort: SortConfig | undefined) => void
  className?: string
}

export function SortHeader({
  label,
  field,
  currentSort,
  onSort,
  className,
}: SortHeaderProps) {
  const isActive = currentSort?.field === field
  const direction = isActive ? currentSort.direction : undefined

  const handleClick = () => {
    if (!isActive) {
      onSort({ field, direction: 'asc' })
    } else if (direction === 'asc') {
      onSort({ field, direction: 'desc' })
    } else {
      onSort(undefined)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
        isActive && 'text-foreground',
        className
      )}
    >
      {label}
      {!isActive && <ArrowUpDown className="h-3 w-3 opacity-40" />}
      {direction === 'asc' && <ArrowUp className="h-3 w-3 text-brand" />}
      {direction === 'desc' && <ArrowDown className="h-3 w-3 text-brand" />}
    </button>
  )
}
