'use client'

import { cn } from '@/lib/utils'

interface EntityCardProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function EntityCard({ children, onClick, className }: EntityCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:border-gray-300 hover:shadow-md',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
