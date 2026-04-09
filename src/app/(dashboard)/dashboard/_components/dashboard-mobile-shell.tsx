'use client'

import { type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { PullToRefresh } from '@/components/shared/pull-to-refresh'
import { Fab } from '@/components/shared/fab'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { Plus, Truck, Car } from 'lucide-react'

interface DashboardMobileShellProps {
  children: ReactNode
  /** Which view is active — controls FAB speed-dial actions */
  view: 'dispatcher' | 'accounting' | 'owner'
}

/**
 * Client-side mobile shell that wraps dashboard content with:
 * 1. Pull-to-refresh (connected to React Query invalidation)
 * 2. FAB speed-dial for primary mobile actions
 *
 * Renders PullToRefresh on all viewports (it already hides its indicator
 * on desktop via lg:hidden). The FAB is hidden on desktop via the Fab
 * component's own lg:hidden class.
 */
export function DashboardMobileShell({ children, view }: DashboardMobileShellProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { isMobile } = useIsMobile()

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
  }

  const fabActions = [
    {
      label: 'New Order',
      icon: <Car className="h-5 w-5" />,
      onClick: () => router.push('/orders?new=1'),
    },
    ...(view === 'dispatcher' || view === 'owner'
      ? [
          {
            label: 'New Trip',
            icon: <Truck className="h-5 w-5" />,
            onClick: () => router.push('/dispatch?new=1'),
          },
        ]
      : []),
  ]

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      {children}

      {/* FAB only renders on mobile — Fab component uses lg:hidden internally */}
      {isMobile && (
        <Fab
          icon={<Plus className="h-6 w-6" />}
          label="Quick actions"
          actions={fabActions}
        />
      )}
    </PullToRefresh>
  )
}
