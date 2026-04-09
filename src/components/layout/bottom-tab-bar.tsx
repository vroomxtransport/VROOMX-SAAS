'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HugeiconsIcon } from '@hugeicons/react'
import { BOTTOM_TAB_ITEMS } from '@/lib/nav-config'
import { useSidebarStore } from '@/stores/sidebar-store'
import { cn } from '@/lib/utils'
import { motion } from 'motion/react'

export function BottomTabBar() {
  const pathname = usePathname()
  const { toggleMoreSheet } = useSidebarStore()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-14 items-stretch">
        {BOTTOM_TAB_ITEMS.map((tab) => {
          const isActive = !tab.isTrigger && (
            pathname === tab.href || pathname.startsWith(tab.href + '/')
          )

          if (tab.isTrigger) {
            return (
              <button
                key={tab.name}
                onClick={toggleMoreSheet}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground active:scale-95 transition-transform"
              >
                <HugeiconsIcon icon={tab.icon} size={20} />
                <span className="text-[10px] font-medium">{tab.name}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform',
                isActive ? 'text-brand' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-brand"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <HugeiconsIcon icon={tab.icon} size={20} />
              <span className="text-[10px] font-medium">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
