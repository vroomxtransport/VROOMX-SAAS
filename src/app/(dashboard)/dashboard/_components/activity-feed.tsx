import { cn } from '@/lib/utils'
import {
  Package,
  Truck,
  FileText,
  PlusCircle,
  DollarSign,
  CheckCircle2,
  MapPin,
  Wrench,
  UserPlus,
  CreditCard,
} from 'lucide-react'

type EventType = 'order' | 'trip' | 'invoice' | 'driver' | 'maintenance'

const EVENT_COLORS: Record<EventType, string> = {
  order: 'bg-blue-500',
  trip: 'bg-amber-500',
  invoice: 'bg-emerald-500',
  driver: 'bg-violet-500',
  maintenance: 'bg-red-500',
}

const EVENT_ICON_BG: Record<EventType, string> = {
  order: 'bg-blue-50 dark:bg-blue-950/30',
  trip: 'bg-amber-50 dark:bg-amber-950/30',
  invoice: 'bg-emerald-50 dark:bg-emerald-950/30',
  driver: 'bg-violet-50 dark:bg-violet-950/30',
  maintenance: 'bg-red-50 dark:bg-red-950/30',
}

const EVENT_ICON_COLORS: Record<EventType, string> = {
  order: 'text-blue-500',
  trip: 'text-amber-500',
  invoice: 'text-emerald-500',
  driver: 'text-violet-500',
  maintenance: 'text-red-500',
}

const ACTIVITY_EVENTS = [
  { text: 'Order ORD-1047 marked as Picked Up', time: '2 hours ago', icon: Package, type: 'order' as EventType },
  { text: 'Trip T-0089 started (Driver: Mike R.)', time: '3 hours ago', icon: Truck, type: 'trip' as EventType },
  { text: 'Invoice #INV-0034 sent to ABC Transport', time: '5 hours ago', icon: FileText, type: 'invoice' as EventType },
  { text: 'New order ORD-1048 created', time: '6 hours ago', icon: PlusCircle, type: 'order' as EventType },
  { text: 'Payment of $1,200 recorded on ORD-1041', time: 'Yesterday', icon: DollarSign, type: 'invoice' as EventType },
  { text: 'Driver Sarah K. completed Trip T-0087', time: 'Yesterday', icon: CheckCircle2, type: 'order' as EventType },
  { text: 'Order ORD-1042 delivered to Phoenix, AZ', time: 'Yesterday', icon: MapPin, type: 'order' as EventType },
  { text: 'Truck #105 status changed to Maintenance', time: '2 days ago', icon: Wrench, type: 'maintenance' as EventType },
  { text: 'New driver Tom B. added to fleet', time: '2 days ago', icon: UserPlus, type: 'driver' as EventType },
  { text: 'Invoice #INV-0033 paid - $2,400 received', time: '3 days ago', icon: CreditCard, type: 'invoice' as EventType },
]

function getTimeGroup(time: string): string {
  if (time.includes('hours ago') || time.includes('hour ago') || time.includes('minutes ago') || time.includes('just now')) {
    return 'Today'
  }
  if (time === 'Yesterday') {
    return 'Yesterday'
  }
  return 'Earlier'
}

export function ActivityFeed() {
  // Pre-compute group headers to avoid reassignment during render
  const eventsWithGroups = ACTIVITY_EVENTS.map((event, idx) => {
    const group = getTimeGroup(event.time)
    const prevGroup = idx > 0 ? getTimeGroup(ACTIVITY_EVENTS[idx - 1].time) : ''
    return { ...event, group, showGroupHeader: group !== prevGroup }
  })

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-blue-500" />
          Recent Activity
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
          Live
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto relative">
        <div className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-brand via-border-subtle/50 to-transparent" />
        <div className="space-y-0">
          {eventsWithGroups.map((event, idx) => {
            const Icon = event.icon
            return (
              <div key={idx}>
                {event.showGroupHeader && (
                  <div className="flex items-center gap-3 py-2 first:pt-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{event.group}</span>
                    <div className="flex-1 h-px bg-border-subtle/60" />
                  </div>
                )}
                <div className="group relative flex items-start gap-3 rounded-xl py-2 px-1 transition-colors hover:bg-muted/40">
                  <div className="relative z-10 flex items-center justify-center">
                    <span
                      className={cn(
                        'h-[9px] w-[9px] rounded-full ring-4 ring-surface',
                        EVENT_COLORS[event.type],
                        idx === 0 && 'animate-pulse'
                      )}
                    />
                  </div>
                  <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={cn('rounded-lg p-1.5 shrink-0 transition-transform group-hover:scale-110', EVENT_ICON_BG[event.type])}>
                        <Icon className={cn('h-3.5 w-3.5', EVENT_ICON_COLORS[event.type])} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground leading-snug">{event.text}</p>
                        {idx === 0 && (
                          <span className="mt-1 inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                            New
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                      {event.time}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
