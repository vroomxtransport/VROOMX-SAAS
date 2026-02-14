'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, LayoutDashboard } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  dispatch: 'Dispatch',
  trucks: 'Fleet',
  drivers: 'Drivers',
  brokers: 'Brokers',
  billing: 'Billing',
  settings: 'Settings',
}

function isUUID(segment: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = isUUID(segment) ? 'Details' : (ROUTE_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1))
    const isLast = index === segments.length - 1

    return { href, label, isLast }
  })

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
          )}
          {crumb.isLast ? (
            <span className="font-semibold text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
