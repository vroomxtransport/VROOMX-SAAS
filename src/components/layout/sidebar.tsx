'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/stores/sidebar-store'
import { hasMinRole } from '@/lib/tier'
import type { TenantRole } from '@/types'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardSquare01Icon,
  TaskDaily02Icon,
  MapsLocation01Icon,
  MessageMultiple02Icon,
  Car01Icon,
  Route01Icon,
  TruckIcon,
  CaravanIcon,
  UserSettings01Icon,
  UserAdd01Icon,
  DeliveryTruck01Icon,
  Wrench01Icon,
  Fuel01Icon,
  HeadsetIcon,
  Analytics02Icon,
  Wallet01Icon,
  ShieldEnergyIcon,
  MoneyBag02Icon,
  Invoice02Icon,
  DeliveryBox01Icon,
  Building06Icon,
  PlugSocketIcon,
  Settings02Icon,
  Cancel01Icon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useChatUnread } from '@/hooks/use-chat-unread'

type NavItem = {
  name: string
  href: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  minRole?: TenantRole
  badge?: number
}

type NavCategory = {
  label: string
  items: NavItem[]
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    label: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: DashboardSquare01Icon },
      { name: 'Tasks', href: '/tasks', icon: TaskDaily02Icon },
      { name: 'Live Map', href: '/live-map', icon: MapsLocation01Icon },
      { name: 'Team Chat', href: '/team-chat', icon: MessageMultiple02Icon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Orders', href: '/orders', icon: Car01Icon },
      { name: 'Trips', href: '/dispatch', icon: Route01Icon },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { name: 'Trucks', href: '/trucks', icon: TruckIcon },
      { name: 'Trailers', href: '/trailers', icon: CaravanIcon },
      { name: 'Drivers', href: '/drivers', icon: UserSettings01Icon, minRole: 'dispatcher' },
      { name: 'Onboarding', href: '/onboarding', icon: UserAdd01Icon, minRole: 'dispatcher' },
      { name: 'Local Runs', href: '/local-runs', icon: DeliveryTruck01Icon, minRole: 'dispatcher' },
      { name: 'Maintenance', href: '/maintenance', icon: Wrench01Icon, minRole: 'dispatcher' },
      { name: 'Fuel Tracking', href: '/fuel-tracking', icon: Fuel01Icon, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'People',
    items: [
      { name: 'Dispatchers', href: '/dispatchers', icon: HeadsetIcon, minRole: 'admin' },
      { name: 'Performance', href: '/dispatcher-performance', icon: Analytics02Icon, minRole: 'admin' },
    ],
  },
  {
    label: 'Safety & Compliance',
    items: [
      { name: 'Safety & Compliance', href: '/compliance', icon: ShieldEnergyIcon, minRole: 'admin' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { name: 'Financials', href: '/financials', icon: MoneyBag02Icon, minRole: 'admin' },
      { name: 'Billing', href: '/billing', icon: Invoice02Icon, minRole: 'admin' },
      { name: 'Payroll', href: '/payroll', icon: Wallet01Icon, minRole: 'admin' },
      { name: 'Local Driver Pay', href: '/local-driver-payroll', icon: DeliveryBox01Icon, minRole: 'admin' },
      { name: 'Brokers', href: '/brokers', icon: Building06Icon, minRole: 'dispatcher' },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Integrations', href: '/integrations', icon: PlugSocketIcon },
      { name: 'Settings', href: '/settings', icon: Settings02Icon, minRole: 'admin' },
    ],
  },
]

interface SidebarProps {
  userRole: TenantRole
  tenantName: string
  userId: string
}

export function Sidebar({ userRole, tenantName, userId }: SidebarProps) {
  const pathname = usePathname()
  const { isOpen, close, isCollapsed, toggleCollapse } = useSidebarStore()
  const { totalUnread } = useChatUnread(userId)

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
        <div className="flex h-16 items-center border-b border-[var(--sidebar-border-color)] px-3">
          <Link href="/dashboard" className="flex flex-1 items-center justify-center overflow-hidden">
            {isCollapsed ? (
              <Image
                src="/images/logo-white.png"
                alt="VroomX"
                width={45}
                height={45}
                className="h-[6.7rem] w-auto object-contain brightness-0"
              />
            ) : (
              <Image
                src="/images/logo-white.png"
                alt="VroomX TMS"
                width={196}
                height={67}
                className="h-[7.6rem] w-auto brightness-0"
              />
            )}
          </Link>
          <button
            onClick={close}
            className="lg:hidden shrink-0 rounded-md p-1 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
            aria-label="Close sidebar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* Tenant name */}
        <div
          className={cn(
            'border-b border-[var(--sidebar-border-color)] px-4 py-2 overflow-hidden',
            isCollapsed && 'lg:hidden'
          )}
        >
          <p className="text-sm font-medium text-foreground text-center truncate">{tenantName}</p>
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
              <HugeiconsIcon icon={SidebarRight01Icon} size={16} />
            ) : (
              <>
                <HugeiconsIcon icon={SidebarLeft01Icon} size={16} />
                <span className="text-xs text-[var(--sidebar-category)]">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto py-2", isCollapsed ? "lg:space-y-1 lg:py-1 lg:px-1 px-2" : "space-y-3 px-2")}>
          {filteredCategories.map((category, catIndex) => (
            <div key={category.label}>
              {/* Category label or divider */}
              {isCollapsed ? (
                catIndex > 0 && (
                  <div className="hidden lg:block mx-3 my-1 border-t border-[var(--sidebar-border-color)]" />
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
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  // Inject live unread count for Team Chat
                  const badge = item.href === '/team-chat' && totalUnread > 0 ? totalUnread : undefined

                  const linkContent = (
                    <Link
                      href={item.href}
                      onClick={() => close()}
                      style={{ color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)' }}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 relative',
                        isActive
                          ? 'bg-[var(--sidebar-active)]'
                          : 'hover:bg-[var(--sidebar-hover)] hover:!text-[var(--sidebar-text-active)]',
                        isCollapsed && 'lg:justify-center lg:px-0 lg:py-1.5 lg:mx-auto lg:w-10'
                      )}
                    >
                      {/* Active indicator pill */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand" />
                      )}
                      <HugeiconsIcon
                        icon={item.icon}
                        size={isCollapsed ? 18 : 20}
                        className={cn(
                          'shrink-0 transition-colors',
                          isActive ? 'text-brand' : 'group-hover:text-[var(--sidebar-text-active)]'
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
                      {/* Unread badge — hidden when sidebar is collapsed on desktop */}
                      {badge && !isCollapsed && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-white leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </Link>
                  )

                  if (isCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild className="hidden lg:flex">
                          <div className="relative">
                            {linkContent}
                            {/* Collapsed dot indicator for unread */}
                            {badge && (
                              <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--brand)] ring-2 ring-background" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {item.name}
                          {badge ? ` (${badge > 99 ? '99+' : badge} unread)` : ''}
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
