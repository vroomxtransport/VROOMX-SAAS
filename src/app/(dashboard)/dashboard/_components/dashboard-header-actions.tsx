'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Truck, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { CustomizeDashboard } from './customize-dashboard'
import { DashboardViewSwitcher } from './dashboard-view-switcher'
import type { DashboardView } from '@/app/(dashboard)/dashboard/_lib/resolve-view'

interface DashboardHeaderActionsProps {
  view: DashboardView
  accessibleViews: DashboardView[]
  fullDate: string
}

/**
 * Header action buttons for the dashboard.
 *
 * Mobile layout:
 *   - Primary CTA (New Order) always visible
 *   - Secondary actions (New Trip, Customize) in a "..." overflow dropdown
 *   - View switcher moved to overflow on mobile when multiple views exist
 *
 * Desktop (sm+): all actions rendered inline as before.
 */
export function DashboardHeaderActions({
  view,
  accessibleViews,
  fullDate,
}: DashboardHeaderActionsProps) {
  const showTripButton = view === 'dispatcher' || view === 'owner'
  const canSwitchViews = accessibleViews.length > 1

  return (
    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
      {/* Date badge — hidden on mobile */}
      <span className="hidden sm:inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
        {fullDate}
      </span>

      {/* View switcher — desktop only (mobile gets it in the overflow) */}
      <div className="hidden sm:block">
        <DashboardViewSwitcher currentView={view} accessibleViews={accessibleViews} />
      </div>

      {/* Primary CTA — always visible on all breakpoints */}
      <Button asChild size="sm" className="!text-white">
        <Link href="/orders">
          <Plus className="h-4 w-4" />
          <span>New Order</span>
        </Link>
      </Button>

      {/* Secondary actions — desktop only inline */}
      {showTripButton && (
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <Link href="/dispatch">
            <Plus className="h-4 w-4" />
            New Trip
          </Link>
        </Button>
      )}

      <div className="hidden sm:block">
        <CustomizeDashboard view={view} />
      </div>

      {/* Mobile overflow dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden h-8 w-8 p-0"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {showTripButton && (
            <DropdownMenuItem asChild>
              <Link href="/dispatch" className="flex items-center gap-2 cursor-pointer">
                <Truck className="h-4 w-4 text-muted-foreground" />
                New Trip
              </Link>
            </DropdownMenuItem>
          )}

          {canSwitchViews && (
            <>
              {showTripButton && <DropdownMenuSeparator />}
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Switch view</p>
                <DashboardViewSwitcher currentView={view} accessibleViews={accessibleViews} />
              </div>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 text-muted-foreground text-xs"
            disabled
          >
            <Settings2 className="h-4 w-4" />
            Customize on desktop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
