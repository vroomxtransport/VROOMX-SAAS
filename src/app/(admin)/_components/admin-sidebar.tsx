'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  CreditCard,
  ArrowLeft,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Tenants', href: '/admin/tenants', icon: Building2 },
  { label: 'Audit Log', href: '/admin/audit-log', icon: ScrollText },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
]

interface AdminSidebarProps {
  userEmail: string
}

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname()

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <aside
      className={cn(
        'sidebar-noise flex h-full w-64 shrink-0 flex-col border-r',
        'bg-[var(--sidebar-bg)] border-[var(--sidebar-border-color)]'
      )}
    >
      {/* Logo + Admin badge */}
      <div className="flex h-16 items-center gap-2.5 border-b border-[var(--sidebar-border-color)] px-4">
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <Image
            src="/images/logo-white.png"
            alt="VroomX"
            width={100}
            height={34}
            className="h-7 w-auto object-contain"
          />
          <span className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            <Shield className="h-3 w-3" />
            Admin
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {/* Section label */}
        <div className="mb-2 px-3 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
            Platform
          </span>
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] shadow-[inset_0_0_0_1px_rgba(25,35,52,0.15)]'
                  : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]'
              )}
            >
              {/* Active indicator pill */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-amber-400" />
              )}
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  active ? 'text-amber-400' : 'group-hover:text-[var(--sidebar-text-active)]'
                )}
              />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}

        {/* Divider */}
        <div className="mx-3 my-3 border-t border-[var(--sidebar-border-color)]" />

        {/* Back to App */}
        <Link
          href="/dashboard"
          className="group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--sidebar-text)] transition-all duration-150 hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]"
        >
          <ArrowLeft className="h-5 w-5 shrink-0 transition-colors group-hover:text-[var(--sidebar-text-active)]" />
          <span className="whitespace-nowrap">Back to App</span>
        </Link>
      </nav>

      {/* Footer — user email */}
      <div className="border-t border-[var(--sidebar-border-color)] px-4 py-3">
        <p className="truncate text-xs text-[var(--sidebar-category)]" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  )
}
