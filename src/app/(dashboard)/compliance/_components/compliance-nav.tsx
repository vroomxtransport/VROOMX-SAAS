'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ShieldCheck, UserCheck, Truck, Building2, AlertTriangle } from 'lucide-react'

const TABS = [
  { label: 'Overview', href: '/compliance', icon: ShieldCheck },
  { label: 'Driver Files', href: '/compliance/dqf', icon: UserCheck },
  { label: 'Vehicle Files', href: '/compliance/vehicle', icon: Truck },
  { label: 'Company Files', href: '/compliance/company', icon: Building2 },
  { label: 'Safety Events', href: '/compliance/events', icon: AlertTriangle },
] as const

export function ComplianceNav() {
  const pathname = usePathname()

  return (
    <div className="widget-card flex items-center gap-1 p-1.5 w-fit">
      {TABS.map((tab) => {
        const Icon = tab.icon
        // Overview is active only on exact match; sub-routes match on prefix
        const isActive =
          tab.href === '/compliance'
            ? pathname === '/compliance'
            : pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-lg',
              isActive
                ? 'bg-surface shadow-sm text-foreground border-b-2 border-brand'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
