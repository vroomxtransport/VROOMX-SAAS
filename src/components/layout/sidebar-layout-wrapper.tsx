'use client'

import { useSidebarStore } from '@/stores/sidebar-store'
import { cn } from '@/lib/utils'

interface SidebarLayoutWrapperProps {
  children: React.ReactNode
}

export function SidebarLayoutWrapper({ children }: SidebarLayoutWrapperProps) {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)

  return (
    <div
      className={cn(
        'flex flex-1 flex-col overflow-hidden',
        // Only transition padding-left, not all properties (avoids layout thrashing)
        'lg:transition-[padding-left] lg:duration-300 lg:ease-in-out',
        isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}
    >
      {children}
    </div>
  )
}
