'use client'

import { cn } from '@/lib/utils'
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type IntegrationCategory,
} from '@/lib/integrations/registry'

interface CategoryFilterProps {
  selected: IntegrationCategory | null
  onChange: (category: IntegrationCategory | null) => void
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by category">
      <button
        role="tab"
        aria-selected={selected === null}
        onClick={() => onChange(null)}
        className={cn(
          'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
          selected === null
            ? 'bg-brand text-brand-foreground shadow-sm'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        All
      </button>
      {ALL_CATEGORIES.map((category) => (
        <button
          key={category}
          role="tab"
          aria-selected={selected === category}
          onClick={() => onChange(selected === category ? null : category)}
          className={cn(
            'inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200',
            selected === category
              ? 'bg-brand text-brand-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  )
}
