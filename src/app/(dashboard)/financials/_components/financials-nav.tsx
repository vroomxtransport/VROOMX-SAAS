'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Receipt, FileText, TrendingUp, Route, Clock, Truck, Sparkles, CreditCard, Wallet, Package } from 'lucide-react'

const TABS = [
  { label: 'Dashboard', href: '/financials', icon: BarChart3 },
  { label: 'Billing', href: '/billing', icon: CreditCard },
  { label: 'Payroll', href: '/payroll', icon: Wallet },
  { label: 'Local Driver Pay', href: '/local-driver-payroll', icon: Package },
  { label: 'Trip Analytics', href: '/financials/trip-analytics', icon: TrendingUp },
  { label: 'Lane Analytics', href: '/financials/lanes', icon: Route },
  { label: 'On-Time', href: '/financials/on-time', icon: Clock },
  { label: 'Fleet', href: '/financials/fleet', icon: Truck },
  { label: 'Forecast', href: '/financials/forecast', icon: Sparkles },
  { label: 'Expenses', href: '/financials/expenses', icon: Receipt },
  { label: 'P&L Report', href: '/financials/reports', icon: FileText },
] as const

export function FinancialsNav() {
  const pathname = usePathname()

  return (
    <div className="widget-card flex items-center gap-1 p-1.5 overflow-x-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 whitespace-nowrap',
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
