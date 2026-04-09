'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Headset, Briefcase, Calculator, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardView } from '@/app/(dashboard)/dashboard/_lib/resolve-view'

const VIEWS: {
  view: DashboardView
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { view: 'dispatcher', label: 'Dispatcher', icon: Headset },
  { view: 'owner', label: 'Owner', icon: Briefcase },
  { view: 'accounting', label: 'Accounting', icon: Calculator },
]

interface DashboardViewSwitcherProps {
  currentView: DashboardView
  accessibleViews: DashboardView[]
}

export function DashboardViewSwitcher({
  currentView,
  accessibleViews,
}: DashboardViewSwitcherProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canSwitch = accessibleViews.length > 1

  function handleViewChange(view: DashboardView) {
    if (view === currentView) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`/dashboard?${params.toString()}`)
  }

  // If only one view accessible, show a locked indicator
  if (!canSwitch) {
    const activeConfig = VIEWS.find((v) => v.view === currentView)
    if (!activeConfig) return null
    const Icon = activeConfig.icon

    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-sm">
        <Icon className="h-3.5 w-3.5 text-brand" />
        <span className="text-xs font-medium text-foreground hidden sm:inline">
          {activeConfig.label}
        </span>
        <Lock className="h-3 w-3 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1 shadow-sm">
      {VIEWS.filter((v) => accessibleViews.includes(v.view)).map(
        ({ view, label, icon: Icon }) => {
          const isActive = currentView === view
          return (
            <button
              key={view}
              onClick={() => handleViewChange(view)}
              title={label}
              className={cn(
                'relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
                isActive
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isActive ? 'text-white' : ''
                )}
              />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        }
      )}
    </div>
  )
}
