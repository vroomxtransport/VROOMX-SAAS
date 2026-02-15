import { cn } from '@/lib/utils'
import { Truck, Users, Layers } from 'lucide-react'

interface FleetPulseProps {
  trucks: { active: number; total: number }
  drivers: { onTrip: number; total: number }
  capacity: { used: number; total: number }
}

function ProgressRow({
  icon: Icon,
  label,
  sublabel,
  current,
  total,
  color,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  sublabel: string
  current: number
  total: number
  color: 'blue' | 'violet' | 'amber'
  trend?: string
}) {
  const pct = total > 0 ? (current / total) * 100 : 0
  const isOverloaded = color === 'amber' && pct > 90

  const barColors = {
    blue: 'bg-gradient-to-r from-blue-500 to-blue-400',
    violet: 'bg-gradient-to-r from-violet-500 to-violet-400',
    amber: isOverloaded ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-amber-500 to-amber-400',
  }

  const glowColors = {
    blue: '#3b82f6',
    violet: '#8b5cf6',
    amber: isOverloaded ? '#dc2626' : '#f59e0b',
  }

  const iconBg = {
    blue: 'bg-[var(--accent-blue-bg)]',
    violet: 'bg-[var(--accent-violet-bg)]',
    amber: 'bg-[var(--accent-amber-bg)]',
  }

  const iconColor = {
    blue: 'text-[var(--accent-blue)]',
    violet: 'text-[var(--accent-violet)]',
    amber: 'text-[var(--accent-amber)]',
  }

  const glowColor = glowColors[color]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        <div className={cn('rounded-lg p-2', iconBg[color])}>
          <Icon className={cn('h-4 w-4', iconColor[color])} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {current}/{total}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-border-subtle overflow-hidden">
        <div
          className={cn('h-2 rounded-full transition-all duration-500', barColors[color])}
          style={{
            width: `${Math.min(pct, 100)}%`,
            ...(pct > 50 ? { boxShadow: `0 0 8px ${glowColor}, 0 0 16px ${glowColor}40` } : {}),
          }}
        />
      </div>
      {color === 'amber' && pct > 85 && (
        <div className="relative -mt-2 flex justify-end" style={{ paddingRight: `${100 - Math.min(pct, 100)}%` }}>
          <span className="absolute h-3 w-3 rounded-full bg-red-500/30 animate-pulse-ring" />
        </div>
      )}
      {trend && (
        <p className="text-[11px] text-muted-foreground/70 mt-1">{trend}</p>
      )}
    </div>
  )
}

export function FleetPulse({ trucks, drivers, capacity }: FleetPulseProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Fleet Pulse</h3>
      <div className="space-y-3">
        <ProgressRow
          icon={Truck}
          label="Trucks"
          sublabel="Active vehicles"
          current={trucks.active}
          total={trucks.total}
          color="blue"
          trend="+2 since last week"
        />
        <ProgressRow
          icon={Users}
          label="Drivers"
          sublabel="Currently on trip"
          current={drivers.onTrip}
          total={drivers.total}
          color="violet"
          trend="3 available for dispatch"
        />
        <ProgressRow
          icon={Layers}
          label="Capacity"
          sublabel="Slots in use"
          current={capacity.used}
          total={capacity.total}
          color="amber"
          trend="Peak hours: 2PM-6PM"
        />
      </div>
    </div>
  )
}
