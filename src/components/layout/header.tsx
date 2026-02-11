'use client'

import { useSidebarStore } from '@/stores/sidebar-store'
import { Menu } from 'lucide-react'
import { UserMenu } from './user-menu'
import type { TenantRole, SubscriptionStatus } from '@/types'

interface HeaderProps {
  userName: string
  userEmail: string
  tenantName: string
  userRole: TenantRole
  plan: string
  subscriptionStatus: SubscriptionStatus
}

export function Header({
  userName,
  userEmail,
  tenantName,
  userRole,
  plan,
  subscriptionStatus,
}: HeaderProps) {
  const { toggle } = useSidebarStore()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <button
        onClick={toggle}
        className="rounded-md p-2 hover:bg-gray-100 lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-6 w-6 text-gray-700" />
      </button>

      <div className="hidden lg:block" />

      <UserMenu
        userName={userName}
        userEmail={userEmail}
        tenantName={tenantName}
        userRole={userRole}
        plan={plan}
        subscriptionStatus={subscriptionStatus}
      />
    </header>
  )
}
