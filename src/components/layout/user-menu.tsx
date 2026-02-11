'use client'

import { logoutAction } from '@/app/actions/logout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getTierDisplayName, getStatusBadgeColor } from '@/lib/tier'
import { Settings, LogOut } from 'lucide-react'
import Link from 'next/link'
import type { TenantRole, SubscriptionStatus } from '@/types'

interface UserMenuProps {
  userName: string
  userEmail: string
  tenantName: string
  userRole: TenantRole
  plan: string
  subscriptionStatus: SubscriptionStatus
}

export function UserMenu({
  userName,
  userEmail,
  tenantName,
  userRole,
  plan,
  subscriptionStatus,
}: UserMenuProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleLogout = async () => {
    await logoutAction()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-blue-600 text-white text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500">{userRole}</p>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="space-y-1">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-gray-500">Organization</p>
          <p className="text-sm font-medium text-gray-900">{tenantName}</p>
          <div className="mt-2 flex gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeColor(subscriptionStatus)}`}
            >
              {subscriptionStatus}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {getTierDisplayName(plan)}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
