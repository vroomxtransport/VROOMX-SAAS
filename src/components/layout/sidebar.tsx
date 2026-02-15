'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/stores/sidebar-store'
import { hasMinRole } from '@/lib/tier'
import type { TenantRole } from '@/types'
import {
  LayoutDashboard,
  PackageSearch,
  Route,
  Truck,
  UserCog,
  Landmark,
  Receipt,
  Settings,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Map,
  ClipboardCheck,
  Navigation,
  Wrench,
  Fuel,
  Users,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  minRole?: TenantRole
}

type NavCategory = {
  label: string
  items: NavItem[]
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Tasks', href: '/tasks', icon: ClipboardCheck },
      { name: 'Live Map', href: '/live-map', icon: Map },
      { name: 'Team Chat', href: '/team-chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Orders', href: '/orders', icon: PackageSearch },
      { name: 'Dispatch', href: '/dispatch', icon: Route },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { name: 'Trucks', href: '/trucks', icon: Truck },
      { name: 'Drivers', href: '/drivers', icon: UserCog, minRole: 'dispatcher' },
      { name: 'Local Drives', href: '/local-drives', icon: Navigation, minRole: 'dispatcher' },
      { name: 'Maintenance', href: '/maintenance', icon: Wrench, minRole: 'dispatcher' },
      { name: 'Fuel Tracking', href: '/fuel-tracking', icon: Fuel, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Dispatchers', href: '/dispatchers', icon: Users, minRole: 'admin' },
      { name: 'Performance', href: '/dispatcher-performance', icon: TrendingUp, minRole: 'admin' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { name: 'Compliance', href: '/compliance', icon: ShieldCheck, minRole: 'admin' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Financials', href: '/financials', icon: DollarSign, minRole: 'admin' },
      { name: 'Billing', href: '/billing', icon: Receipt, minRole: 'admin' },
      { name: 'Brokers', href: '/brokers', icon: Landmark, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings, minRole: 'admin' },
    ],
  },
]

interface SidebarProps {
  userRole: TenantRole
  tenantName: string
}

export function Sidebar({ userRole, tenantName }: SidebarProps) {
  const pathname = usePathname()
  const { isOpen, close, isCollapsed, toggleCollapse } = useSidebarStore()

  const filteredCategories = NAV_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => {
      if (!item.minRole) return true
      return hasMinRole(userRole, item.minRole)
    }),
  })).filter((category) => category.items.length > 0)

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'sidebar-noise fixed left-0 top-0 z-50 flex h-full flex-col border-r transition-all duration-300 ease-in-out',
          'bg-[var(--sidebar-bg)] border-[var(--sidebar-border-color)]',
          // Mobile: always w-64, slide in/out
          'w-64 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapse to w-16
          isCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Logo area */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--sidebar-border-color)] px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#fb7232] to-[#f59e0b] shadow-[var(--brand-glow)]">
              <Truck className="h-4.5 w-4.5 text-white" />
            </div>
            <span
              className={cn(
                'text-lg font-bold tracking-tight whitespace-nowrap transition-opacity duration-200',
                'bg-gradient-to-r from-white to-[#f9a06c] bg-clip-text text-transparent',
                isCollapsed && 'lg:hidden'
              )}
            >
              VroomX
            </span>
          </div>
          <button
            onClick={close}
            className="lg:hidden rounded-md p-1 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tenant name */}
        <div
          className={cn(
            'border-b border-[var(--sidebar-border-color)] px-4 py-2 overflow-hidden',
            isCollapsed && 'lg:hidden'
          )}
        >
          <p className="text-sm font-medium text-[var(--sidebar-text)] truncate">{tenantName}</p>
        </div>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex px-3 py-1.5">
          <button
            onClick={toggleCollapse}
            className={cn(
              'flex items-center gap-2 rounded-md p-1.5 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)] transition-colors',
              isCollapsed && 'lg:mx-auto'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-xs text-[var(--sidebar-category)]">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {filteredCategories.map((category, catIndex) => (
            <div key={category.label}>
              {/* Category label or divider */}
              {isCollapsed ? (
                catIndex > 0 && (
                  <div className="hidden lg:block mx-3 mb-2 border-t border-[var(--sidebar-border-color)]" />
                )
              ) : (
                <div className="mb-1.5 px-3 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    {category.label}
                  </span>
                </div>
              )}

              {/* Nav items */}
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                  const linkContent = (
                    <Link
                      href={item.href}
                      onClick={() => close()}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 relative',
                        isActive
                          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)] shadow-[inset_0_0_0_1px_rgba(251,114,50,0.15),var(--brand-glow)]'
                          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]',
                        isCollapsed && 'lg:justify-center lg:px-0 lg:py-2.5'
                      )}
                    >
                      {/* Active indicator pill */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[var(--brand)] shadow-[0_0_8px_var(--sidebar-active-glow)]" />
                      )}
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0 transition-colors',
                          isActive ? 'text-[var(--brand)]' : 'group-hover:text-[var(--sidebar-text-active)]'
                        )}
                      />
                      <span
                        className={cn(
                          'whitespace-nowrap transition-opacity duration-200',
                          isCollapsed && 'lg:hidden'
                        )}
                      >
                        {item.name}
                      </span>
                    </Link>
                  )

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild className="hidden lg:flex">
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                        </TooltipContent>
                        {/* Mobile: show without tooltip */}
                        <div className="lg:hidden">{linkContent}</div>
                      </Tooltip>
                    )
                  }

                  return <div key={item.href}>{linkContent}</div>
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--sidebar-border-color)] px-4 py-2">
          <p
            className={cn(
              'text-xs text-[var(--sidebar-category)] text-center',
              isCollapsed && 'lg:text-[10px]'
            )}
          >
            {isCollapsed ? (
              <span className="hidden lg:inline">v0.1</span>
            ) : (
              'VroomX TMS v0.1.0'
            )}
            <span className="lg:hidden">VroomX TMS v0.1.0</span>
          </p>
        </div>
      </aside>
    </TooltipProvider>
  )
}
