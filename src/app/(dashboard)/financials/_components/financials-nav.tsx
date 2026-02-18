'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Receipt, FileText } from 'lucide-react'

const TABS = [
  { label: 'Dashboard', href: '/financials', icon: BarChart3 },
  { label: 'Business Expenses', href: '/financials/expenses', icon: Receipt },
  { label: 'P&L Report', href: '/financials/reports', icon: FileText },
] as const

export function FinancialsNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1 w-fit">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
