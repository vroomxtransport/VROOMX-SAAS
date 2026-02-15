import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface QuickActionCardProps {
  href: string
  icon: LucideIcon
  label: string
  description: string
  disabled?: boolean
}

export function QuickActionCard({ href, icon: Icon, label, description, disabled }: QuickActionCardProps) {
  if (disabled) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface/50 p-3 opacity-50 cursor-not-allowed"
        aria-disabled="true"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
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
        'transition-all duration-200 hover:border-brand/40 hover:shadow-[0_2px_12px_rgba(251,114,50,0.08)]'
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted transition-all duration-200 group-hover:bg-brand/10 group-hover:shadow-[0_0_12px_rgba(251,114,50,0.12)]">
        <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-brand" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </Link>
  )
}
