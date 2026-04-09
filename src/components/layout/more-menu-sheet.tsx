'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { NAV_CATEGORIES, getMoreMenuItems } from '@/lib/nav-config'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useChatUnread } from '@/hooks/use-chat-unread'
import type { TenantRole } from '@/types'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface MoreMenuSheetProps {
  userRole: TenantRole
  userId: string
}

export function MoreMenuSheet({ userRole, userId }: MoreMenuSheetProps) {
  const pathname = usePathname()
  const { isMoreSheetOpen, closeMoreSheet } = useSidebarStore()
  const { totalUnread } = useChatUnread(userId)

  const categories = getMoreMenuItems(NAV_CATEGORIES, userRole)

  return (
    <Sheet open={isMoreSheetOpen} onOpenChange={(open) => !open && closeMoreSheet()}>
      <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-2xl px-0 pb-[env(safe-area-inset-bottom,0px)]">
        <SheetHeader className="px-6 pb-2">
          <SheetTitle className="text-base font-semibold">More</SheetTitle>
        </SheetHeader>

        <nav className="overflow-y-auto px-2 pb-6">
          {categories.map((category) => (
            <div key={category.label} className="mb-3">
              <p className="mb-1 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category.label}
              </p>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const accountingRoutes = ['/financials', '/billing', '/payroll', '/local-driver-payroll']
                  const isActive = item.href === '/financials'
                    ? accountingRoutes.some((r) => pathname === r || pathname.startsWith(r + '/'))
                    : pathname === item.href || pathname.startsWith(item.href + '/')
                  const badge = item.href === '/team-chat' && totalUnread > 0 ? totalUnread : undefined

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMoreSheet}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors min-h-[44px]',
                        isActive
                          ? 'bg-accent text-brand'
                          : 'text-foreground hover:bg-accent'
                      )}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        size={20}
                        className={cn('shrink-0', isActive && 'text-brand')}
                      />
                      <span className="flex-1">{item.name}</span>
                      {badge && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white leading-none">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
