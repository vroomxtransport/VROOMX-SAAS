'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/stores/sidebar-store'
import type { TenantRole } from '@/types'
import { HugeiconsIcon } from '@hugeicons/react'
import {
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
import { useEffect } from 'react'
import { useChatUnread } from '@/hooks/use-chat-unread'
import { ChevronDown } from 'lucide-react'
import { NAV_CATEGORIES, filterNavByRole } from '@/lib/nav-config'

interface SidebarProps {
  userRole: TenantRole
  tenantName: string
  userId: string
}

export function Sidebar({ userRole, tenantName, userId }: SidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, toggleCollapse, collapsedCategories, toggleCategory, expandCategory } = useSidebarStore()
  const { totalUnread } = useChatUnread(userId)

  const filteredCategories = filterNavByRole(NAV_CATEGORIES, userRole)

  // Auto-expand category if it contains the active route
  useEffect(() => {
    const activeCategory = filteredCategories.find((cat) =>
      cat.items.some((item) => {
        const accountingRoutes = ['/financials', '/billing', '/payroll', '/local-driver-payroll']
        return item.href === '/financials'
          ? accountingRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))
          : pathname === item.href || pathname.startsWith(item.href + '/')
      })
    )
    if (activeCategory && collapsedCategories.includes(activeCategory.label)) {
      expandCategory(activeCategory.label)
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TooltipProvider delayDuration={0}>
      {/* Sidebar — desktop only, bottom tab bar handles mobile nav */}
      <aside
        className={cn(
          'sidebar-noise fixed left-0 top-0 z-50 hidden h-full flex-col border-r transition-all duration-300 ease-in-out lg:flex',
          'bg-[var(--sidebar-bg)] border-[var(--sidebar-border-color)]',
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
{/* Close button removed — mobile nav uses bottom tab bar */}
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
          {filteredCategories.map((category, catIndex) => {
            const isMainCategory = category.label === 'Main'
            const isCategoryCollapsed = !isMainCategory && collapsedCategories.includes(category.label)

            return (
            <div key={category.label}>
              {/* Category label or divider */}
              {isCollapsed ? (
                catIndex > 0 && (
                  <div className="hidden lg:block mx-3 my-1 border-t border-[var(--sidebar-border-color)]" />
                )
              ) : isMainCategory ? (
                <div className="mb-1.5 px-3 pt-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-category)]">
                    {category.label}
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => toggleCategory(category.label)}
                  className="mb-1.5 px-3 pt-1 flex items-center justify-between w-full group/cat"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--sidebar-category)] group-hover/cat:text-[var(--sidebar-text-active)] transition-colors">
                    {category.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 text-[var(--sidebar-category)] group-hover/cat:text-[var(--sidebar-text-active)] transition-all duration-200',
                      isCategoryCollapsed && '-rotate-90'
                    )}
                  />
                </button>
              )}

              {/* Nav items — animated collapse */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-200 ease-in-out',
                  !isCollapsed && isCategoryCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                )}
              >
              <div className="space-y-0.5 overflow-hidden min-h-0">
                {category.items.map((item) => {
                  // Accounting hub: highlight for /financials, /billing, /payroll, /local-driver-payroll
                  const accountingRoutes = ['/financials', '/billing', '/payroll', '/local-driver-payroll']
                  const isActive = item.href === '/financials'
                    ? accountingRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))
                    : pathname === item.href || pathname.startsWith(item.href + '/')
                  // Inject live unread count for Team Chat
                  const badge = item.href === '/team-chat' && totalUnread > 0 ? totalUnread : undefined

                  const linkContent = (
                    <Link
                      href={item.href}
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
            </div>
          )})}
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
