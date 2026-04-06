'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Sorting01Icon, ArrowUp01Icon, ArrowDown01Icon } from '@hugeicons/core-free-icons'
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
      {!isActive && <HugeiconsIcon icon={Sorting01Icon} size={12} className="opacity-60" />}
      {direction === 'asc' && <HugeiconsIcon icon={ArrowUp01Icon} size={12} className="text-brand" />}
      {direction === 'desc' && <HugeiconsIcon icon={ArrowDown01Icon} size={12} className="text-brand" />}
    </button>
  )
}
