'use client'

import { LayoutGrid, List } from 'lucide-react'
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
        <LayoutGrid className="h-4 w-4" />
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
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  )
}
