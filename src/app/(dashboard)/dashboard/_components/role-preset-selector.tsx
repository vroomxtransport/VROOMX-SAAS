'use client'

import { Headset, Briefcase, Calculator, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardStore, type DashboardRole } from '@/stores/dashboard-store'

const PRESETS: {
  role: DashboardRole
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}[] = [
  {
    role: 'dispatcher',
    label: 'Dispatcher',
    icon: Headset,
    description: 'Loads, pickups & fleet',
  },
  {
    role: 'owner',
    label: 'Owner',
    icon: Briefcase,
    description: 'Revenue & full overview',
  },
  {
    role: 'accountant',
    label: 'Accountant',
    icon: Calculator,
    description: 'Invoices & financials',
  },
]

export function RolePresetSelector() {
  const { activePreset, applyRolePreset } = useDashboardStore()

  const isCustom = activePreset === null

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1 shadow-sm">
      {PRESETS.map(({ role, label, icon: Icon }) => {
        const isActive = activePreset === role
        return (
          <button
            key={role}
            onClick={() => applyRolePreset(role)}
            title={label}
            className={cn(
              'relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
              isActive
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-white' : '')} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}

      {/* Custom indicator — only visible when layout has been manually modified */}
      {isCustom && (
        <div
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium bg-muted/60 text-foreground"
          title="Custom layout"
        >
          <Settings2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="hidden sm:inline text-muted-foreground">Custom</span>
        </div>
      )}
    </div>
  )
}
