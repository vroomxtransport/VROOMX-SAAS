'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { LayoutGridIcon, MenuSquareIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  viewMode: 'grid' | 'list'
  onViewChange: (mode: 'grid' | 'list') => void
}

export function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="rounded-lg bg-muted p-0.5 flex">
      <button
        type="button"
        onClick={() => onViewChange('grid')}
        className={cn(
          'rounded-md px-2.5 py-1.5 transition-all duration-200 flex items-center gap-1.5 text-sm',
          viewMode === 'grid'
            ? 'bg-surface shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <HugeiconsIcon icon={LayoutGridIcon} size={16} />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        onClick={() => onViewChange('list')}
        className={cn(
          'rounded-md px-2.5 py-1.5 transition-all duration-200 flex items-center gap-1.5 text-sm',
          viewMode === 'list'
            ? 'bg-surface shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <HugeiconsIcon icon={MenuSquareIcon} size={16} />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  )
}
