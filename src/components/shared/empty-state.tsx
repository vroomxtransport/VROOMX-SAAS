'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any // Hugeicons icon data (array) or legacy Lucide React component (function)
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  // Hugeicons icons are arrays of SVG path data; Lucide icons are React component functions
  const isHugeicon = Array.isArray(icon)

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-subtle py-10 text-center">
      <div className="mb-3 rounded-xl bg-accent p-3">
        {isHugeicon ? (
          <HugeiconsIcon icon={icon} size={32} className="text-muted-foreground" />
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (() => { const Icon = icon as any; return <Icon className="h-8 w-8 text-muted-foreground" /> })()
        )}
      </div>

      <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">{description}</p>

      <div className="flex items-center gap-3">
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {action && (
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  )
}
