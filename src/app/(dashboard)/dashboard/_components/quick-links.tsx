'use client'

import Link from 'next/link'
import {
  PackageSearch,
  Route,
  Users,
  Truck,
  Receipt,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { label: 'New Order', href: '/orders', icon: PackageSearch, accent: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  { label: 'Trips', href: '/dispatch', icon: Route, accent: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  { label: 'Drivers', href: '/drivers', icon: Users, accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  { label: 'Fleet', href: '/trucks', icon: Truck, accent: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  { label: 'Billing', href: '/billing', icon: Receipt, accent: 'text-rose-600 bg-rose-50 dark:bg-rose-950/30' },
  { label: 'Reports', href: '/financials/reports', icon: BarChart3, accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
]

export function QuickLinks() {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Quick Links</h3>
      <div className="grid grid-cols-2 gap-2">
        {LINKS.map(({ label, href, icon: Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 rounded-lg border border-border-subtle px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className={cn('rounded-md p-1.5', accent)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
