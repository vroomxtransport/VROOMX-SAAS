'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/stores/sidebar-store'
import { hasMinRole } from '@/lib/tier'
import type { TenantRole } from '@/types'
import {
  LayoutDashboard,
  Truck,
  Package,
  Route,
  Users,
  Building2,
  Receipt,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  minRole?: TenantRole
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/orders', icon: Package },
  { name: 'Dispatch', href: '/dispatch', icon: Route },
  { name: 'Trucks', href: '/trucks', icon: Truck },
  { name: 'Drivers', href: '/drivers', icon: Users, minRole: 'dispatcher' },
  { name: 'Brokers', href: '/brokers', icon: Building2, minRole: 'dispatcher' },
  { name: 'Invoices', href: '/invoices', icon: Receipt, minRole: 'admin' },
  { name: 'Settings', href: '/settings', icon: Settings, minRole: 'admin' },
]

interface SidebarProps {
  userRole: TenantRole
  tenantName: string
}

export function Sidebar({ userRole, tenantName }: SidebarProps) {
  const pathname = usePathname()
  const { isOpen, close } = useSidebarStore()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.minRole) return true
    return hasMinRole(userRole, item.minRole)
  })

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full w-64 bg-white border-r border-gray-200 transition-transform duration-200 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <div className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">VroomX</span>
          </div>
          <button
            onClick={close}
            className="lg:hidden rounded-md p-1 hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Tenant name */}
        <div className="border-b border-gray-200 px-6 py-3">
          <p className="text-sm font-medium text-gray-900 truncate">{tenantName}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <p className="text-xs text-gray-500 text-center">VroomX TMS v0.1.0</p>
        </div>
      </aside>
    </>
  )
}
