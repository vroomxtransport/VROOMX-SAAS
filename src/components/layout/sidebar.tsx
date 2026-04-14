'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSidebarStore } from '@/stores/sidebar-store'
import type { TenantRole } from '@/types'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  SidebarLeft01Icon,
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
          isCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Header — logo + tenant name + collapse toggle */}
        <div className={cn(
          'flex h-14 items-center px-3 gap-2',
          isCollapsed && 'justify-center'
        )}>
          <Link href="/dashboard" className={cn(
            'flex flex-1 items-center gap-2.5 overflow-hidden min-w-0',
            isCollapsed && 'flex-initial justify-center'
          )}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]">
              <Image
                src="/images/logo-white.png"
                alt="VroomX"
                width={20}
                height={20}
                className="h-5 w-auto object-contain"
              />
            </div>
            {!isCollapsed && (
              <span className="text-sm font-semibold text-[var(--sidebar-text-active)] truncate">
                {tenantName}
              </span>
            )}
          </Link>
          {!isCollapsed && (
            <button
              onClick={toggleCollapse}
              className="shrink-0 rounded-md p-1.5 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)] transition-colors"
              aria-label="Collapse sidebar"
            >
              <HugeiconsIcon icon={SidebarLeft01Icon} size={16} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 overflow-y-auto',
          isCollapsed ? 'py-2 px-1.5' : 'py-2 px-2.5'
        )}>
          {filteredCategories.map((category, catIndex) => {
            const isMainCategory = category.label === 'Main'
            const isCategoryCollapsed = !isMainCategory && collapsedCategories.includes(category.label)

            return (
              <div key={category.label}>
                {/* Gradient divider between Main and grouped sections */}
                {catIndex === 1 && (
                  isCollapsed ? (
                    <div className="mx-2 my-2 h-px bg-[var(--sidebar-border-color)]" />
                  ) : (
                    <div className="mx-3 my-3 h-px bg-gradient-to-r from-transparent via-[var(--sidebar-border-color)] to-transparent" />
                  )
                )}

                {/* Thin divider between grouped sections (not before first group) */}
                {catIndex > 1 && !isCollapsed && (
                  <div className="my-1" />
                )}
                {catIndex > 1 && isCollapsed && (
                  <div className="mx-2 my-1.5 h-px bg-[var(--sidebar-border-color)]" />
                )}

                {/* Section header for non-Main categories (expanded sidebar only) */}
                {!isMainCategory && !isCollapsed && (
                  <button
                    onClick={() => toggleCategory(category.label)}
                    className={cn(
                      'mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 transition-colors duration-150',
                      !isCategoryCollapsed
                        ? 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-active)]'
                        : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]'
                    )}
                  >
                    {category.icon && (
                      <HugeiconsIcon icon={category.icon} size={18} className="shrink-0" />
                    )}
                    <span className="flex-1 text-left text-[13px] font-medium">{category.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
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
                  <div className="overflow-hidden min-h-0">
                    <div className={cn(
                      'space-y-0.5',
                      !isMainCategory && !isCollapsed && 'relative ml-[22px] pl-3 border-l border-[var(--sidebar-border-color)]'
                    )}>
                      {category.items.map((item) => {
                        const accountingRoutes = ['/financials', '/billing', '/payroll', '/local-driver-payroll']
                        const isActive = item.href === '/financials'
                          ? accountingRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))
                          : pathname === item.href || pathname.startsWith(item.href + '/')
                        const badge = item.href === '/team-chat' && totalUnread > 0 ? totalUnread : undefined

                        const linkContent = (
                          <Link
                            href={item.href}
                            className={cn(
                              'group flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150 relative',
                              isActive
                                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-active)]'
                                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-active)]',
                              isCollapsed && 'lg:justify-center lg:px-0 lg:py-1.5 lg:mx-auto lg:w-10'
                            )}
                          >
                            <HugeiconsIcon
                              icon={item.icon}
                              size={18}
                              className={cn(
                                'shrink-0 transition-colors',
                                isActive ? 'text-[var(--sidebar-text-active)]' : 'group-hover:text-[var(--sidebar-text-active)]'
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
                            </Tooltip>
                          )
                        }

                        return <div key={item.href}>{linkContent}</div>
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3">
          <p
            className={cn(
              'text-[11px] text-[var(--sidebar-category)] text-center',
              isCollapsed && 'lg:text-[10px]'
            )}
          >
            {isCollapsed ? (
              <span className="hidden lg:inline">v0.1</span>
            ) : (
              'VroomX TMS v0.1.0'
            )}
          </p>
        </div>
      </aside>
    </TooltipProvider>
  )
}
