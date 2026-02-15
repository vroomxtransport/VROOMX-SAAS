'use client'

import { cn } from '@/lib/utils'

interface EntityCardProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function EntityCard({ children, onClick, className }: EntityCardProps) {
  const classes = cn(
    'rounded-xl border border-border-subtle bg-surface p-3 shadow-sm text-left w-full',
    onClick && 'cursor-pointer card-hover hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none',
    className
  )

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={classes}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className={classes}>
      {children}
    </div>
  )
}
