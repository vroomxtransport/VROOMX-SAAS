'use client'

import Link from 'next/link'
import {
  Car,
  Route,
  Users,
  Truck,
  Receipt,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { label: 'New Order', href: '/orders', icon: Car, accent: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { label: 'Trips', href: '/dispatch', icon: Route, accent: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  { label: 'Drivers', href: '/drivers', icon: Users, accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { label: 'Fleet', href: '/trucks', icon: Truck, accent: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  { label: 'Billing', href: '/billing', icon: Receipt, accent: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  { label: 'Reports', href: '/financials/reports', icon: BarChart3, accent: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
]

export function QuickLinks() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-brand" />
          Quick Links
        </span>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-2.5">
        {LINKS.map(({ label, href, icon: Icon, accent, bg }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-surface p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-transparent hover:bg-surface-raised"
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110', bg)}>
              <Icon className={cn('h-5 w-5', accent)} />
            </div>
            <span className="text-xs font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
