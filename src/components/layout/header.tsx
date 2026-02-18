'use client'

import { useSidebarStore } from '@/stores/sidebar-store'
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Breadcrumbs } from './breadcrumbs'
import { CommandSearch } from './command-search'
import { UserMenu } from './user-menu'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { NotificationDropdown } from './notification-dropdown'
import type { TenantRole, SubscriptionStatus } from '@/types'

interface HeaderProps {
  userName: string
  userEmail: string
  tenantName: string
  userRole: TenantRole
  plan: string
  subscriptionStatus: SubscriptionStatus
  userId: string
}

export function Header({
  userName,
  userEmail,
  tenantName,
  userRole,
  plan,
  subscriptionStatus,
  userId,
}: HeaderProps) {
  const { toggle, isCollapsed, toggleCollapse } = useSidebarStore()

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={toggle}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors lg:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        {/* Divider */}
        <div className="hidden md:block h-4 w-px bg-border" />

        {/* Breadcrumbs */}
        <Breadcrumbs />
      </div>

      {/* Center: Command search */}
      <div className="flex-1 flex justify-center px-4">
        <CommandSearch />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <NotificationDropdown userId={userId} />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Divider */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* User menu */}
        <UserMenu
          userName={userName}
          userEmail={userEmail}
          tenantName={tenantName}
          userRole={userRole}
          plan={plan}
          subscriptionStatus={subscriptionStatus}
        />
      </div>
    </header>
  )
}
