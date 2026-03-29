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
  { label: 'New Order', href: '/orders', icon: Car, accent: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'Trips', href: '/dispatch', icon: Route, accent: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Drivers', href: '/drivers', icon: Users, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Fleet', href: '/trucks', icon: Truck, accent: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Billing', href: '/billing', icon: Receipt, accent: 'text-rose-600', bg: 'bg-rose-50' },
  { label: 'Reports', href: '/financials/reports', icon: BarChart3, accent: 'text-indigo-600', bg: 'bg-indigo-50' },
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
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-1.5">
        {LINKS.map(({ label, href, icon: Icon, accent, bg }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-2 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:bg-surface-raised"
          >
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110', bg)}>
              <Icon className={cn('h-4 w-4', accent)} />
            </div>
            <span className="text-[11px] font-medium text-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
