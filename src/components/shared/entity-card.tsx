'use client'

import { cn } from '@/lib/utils'

interface EntityCardProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function EntityCard({ children, onClick, className }: EntityCardProps) {
  const classes = cn(
    'rounded-lg border border-border bg-card p-3 text-left w-full',
    onClick && 'cursor-pointer hover:border-brand/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none transition-[border-color,box-shadow] duration-150',
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
