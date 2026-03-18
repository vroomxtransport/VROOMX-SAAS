'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Receipt, FileText, TrendingUp } from 'lucide-react'

const TABS = [
  { label: 'Dashboard', href: '/financials', icon: BarChart3 },
  { label: 'Trip Analytics', href: '/financials/trip-analytics', icon: TrendingUp },
  { label: 'Business Expenses', href: '/financials/expenses', icon: Receipt },
  { label: 'P&L Report', href: '/financials/reports', icon: FileText },
] as const

export function FinancialsNav() {
  const pathname = usePathname()

  return (
    <div className="widget-card flex items-center gap-1 p-1.5 w-fit">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-surface shadow-sm rounded-lg text-foreground border-b-2 border-brand'
                : 'text-muted-foreground hover:text-foreground rounded-lg'
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
