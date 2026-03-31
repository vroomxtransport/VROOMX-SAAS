'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2,
  Palette,
  Users,
  Shield,
  CreditCard,
  Bell,
  FileText,
  Key,
  Webhook,
  ScrollText,
  AlertTriangle,
  Warehouse,
} from 'lucide-react'
import type { TenantRole } from '@/types'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const SETTINGS_NAV: NavGroup[] = [
  {
    label: 'Organization',
    items: [
      { name: 'Company Profile', href: '/settings/profile', icon: Building2 },
      { name: 'Branding', href: '/settings/branding', icon: Palette },
    ],
  },
  {
    label: 'Team & Access',
    items: [
      { name: 'Members', href: '/settings/members', icon: Users, adminOnly: true },
      { name: 'Roles & Permissions', href: '/settings/roles', icon: Shield, adminOnly: true },
    ],
  },
  {
    label: 'Billing',
    items: [
      { name: 'Plan & Usage', href: '/settings/plan', icon: CreditCard, adminOnly: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Terminals', href: '/settings/terminals', icon: Warehouse },
      { name: 'Notifications', href: '/settings/notifications', icon: Bell },
      { name: 'Order Defaults', href: '/settings/order-defaults', icon: FileText },
    ],
  },
  {
    label: 'Developer',
    items: [
      { name: 'API Keys', href: '/settings/api-keys', icon: Key },
      { name: 'Webhooks', href: '/settings/webhooks', icon: Webhook },
      { name: 'Audit Log', href: '/settings/audit-log', icon: ScrollText },
    ],
  },
]

const DANGER_ZONE_ITEM: NavItem = {
  name: 'Danger Zone',
  href: '/settings/danger',
  icon: AlertTriangle,
  adminOnly: true,
}

function isAdminOrOwner(role: TenantRole): boolean {
  return role === 'admin' || role === 'owner'
}

interface SettingsNavProps {
  userRole: TenantRole
}

export function SettingsNav({ userRole }: SettingsNavProps) {
  const pathname = usePathname()
  const isAdmin = isAdminOrOwner(userRole)

  function isActive(href: string): boolean {
    if (href === '/settings') return pathname === '/settings'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="widget-card !p-3 hidden lg:block" aria-label="Settings navigation">
        {SETTINGS_NAV.map((group, groupIndex) => {
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin)
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label} className={groupIndex > 0 ? 'mt-4' : ''}>
              <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors duration-150',
                          active
                            ? 'bg-accent text-foreground font-medium border-l-[3px] border-brand pl-[5px]'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}

        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-border-subtle">
            <Link
              href={DANGER_ZONE_ITEM.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors duration-150',
                isActive(DANGER_ZONE_ITEM.href)
                  ? 'bg-destructive/10 text-destructive font-medium border-l-[3px] border-destructive pl-[5px]'
                  : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{DANGER_ZONE_ITEM.name}</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Mobile: horizontal scrollable row */}
      <nav
        className="widget-card !p-1.5 flex items-center gap-1 overflow-x-auto lg:hidden scrollbar-hide"
        aria-label="Settings navigation"
      >
        {SETTINGS_NAV.flatMap(group =>
          group.items.filter(item => !item.adminOnly || isAdmin)
        ).map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 shrink-0',
                active
                  ? 'bg-accent text-foreground border-b-2 border-brand'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.name}</span>
            </Link>
          )
        })}

        {isAdmin && (
          <Link
            href={DANGER_ZONE_ITEM.href}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 shrink-0',
              isActive(DANGER_ZONE_ITEM.href)
                ? 'bg-destructive/10 text-destructive border-b-2 border-destructive'
                : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{DANGER_ZONE_ITEM.name}</span>
          </Link>
        )}
      </nav>
    </>
  )
}
