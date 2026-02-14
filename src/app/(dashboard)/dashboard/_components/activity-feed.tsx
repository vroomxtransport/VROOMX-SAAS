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
  let lastGroup = ''

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-lg font-semibold text-foreground mb-3">Recent Activity</h3>
      <div className="relative">
        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-border-subtle via-border-subtle/50 to-transparent" />
        <div className="space-y-0">
          {ACTIVITY_EVENTS.map((event, idx) => {
            const Icon = event.icon
            const group = getTimeGroup(event.time)
            const showGroupHeader = group !== lastGroup
            if (showGroupHeader) {
              lastGroup = group
            }

            return (
              <div key={idx}>
                {showGroupHeader && (
                  <div className="flex items-center gap-3 py-2 first:pt-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group}</span>
                    <div className="flex-1 h-px bg-border-subtle/60" />
                  </div>
                )}
                <div className="relative flex items-start gap-3 py-2">
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
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', EVENT_ICON_COLORS[event.type])} />
                      <p className="text-sm text-foreground">{event.text}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
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
