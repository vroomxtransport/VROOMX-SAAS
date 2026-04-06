import Link from 'next/link'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'

interface QuickActionCardProps {
  href: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any // Hugeicons icon data (array of SVG paths)
  label: string
  description: string
  disabled?: boolean
}

export function QuickActionCard({ href, icon, label, description, disabled }: QuickActionCardProps) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-3 opacity-50 cursor-not-allowed"
        aria-disabled="true"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <HugeiconsIcon icon={icon} size={20} className="text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3',
        'transition-all duration-200 hover:border-brand/40'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-all duration-200 group-hover:bg-brand/10">
        <HugeiconsIcon icon={icon} size={20} className="text-muted-foreground transition-colors group-hover:text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  )
}
