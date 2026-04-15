'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
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
  Activity,
  type LucideIcon,
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
  order: 'bg-blue-50',
  trip: 'bg-amber-50',
  invoice: 'bg-emerald-50',
  driver: 'bg-violet-50',
  maintenance: 'bg-red-50',
}

const EVENT_ICON_COLORS: Record<EventType, string> = {
  order: 'text-blue-500',
  trip: 'text-amber-500',
  invoice: 'text-emerald-500',
  driver: 'text-violet-500',
  maintenance: 'text-red-500',
}

const ACTION_MAP: Record<string, { icon: LucideIcon; type: EventType }> = {
  status_change: { icon: Package, type: 'order' },
  created: { icon: PlusCircle, type: 'order' },
  assigned: { icon: Truck, type: 'trip' },
  picked_up: { icon: Truck, type: 'trip' },
  delivered: { icon: MapPin, type: 'order' },
  invoiced: { icon: FileText, type: 'invoice' },
  invoice_sent: { icon: FileText, type: 'invoice' },
  payment_recorded: { icon: DollarSign, type: 'invoice' },
  paid: { icon: CreditCard, type: 'invoice' },
  completed: { icon: CheckCircle2, type: 'order' },
  driver_assigned: { icon: UserPlus, type: 'driver' },
  maintenance: { icon: Wrench, type: 'maintenance' },
}

const DEFAULT_ACTION = { icon: Package, type: 'order' as EventType }

function getTimeGroup(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (eventDay >= today) return 'Today'
  if (eventDay >= yesterday) return 'Yesterday'
  return 'Earlier'
}

function formatTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return ''
  }
}

async function fetchActivityLogs(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('order_activity_logs')
    .select('id, action, description, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) throw error
  return data ?? []
}

export function ActivityFeed() {
  const supabase = createClient()

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'activity-feed'],
    queryFn: () => fetchActivityLogs(supabase),
    staleTime: 30_000,
  })

  const events = logs.map((log) => {
    const mapping = ACTION_MAP[log.action] ?? DEFAULT_ACTION
    const date = new Date(log.created_at)
    return {
      id: log.id,
      text: log.description,
      time: formatTime(log.created_at),
      icon: mapping.icon,
      type: mapping.type,
      date,
      group: getTimeGroup(date),
    }
  })

  const eventsWithGroups = events.map((event, idx) => ({
    ...event,
    showGroupHeader: idx === 0 || event.group !== events[idx - 1].group,
  }))

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-blue-500" />
          Recent Activity
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-blue-600">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
          Live
        </span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : eventsWithGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Activity className="h-7 w-7 opacity-40" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <div className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-gradient-to-b from-brand via-border-subtle/50 to-transparent" />
          <div className="space-y-0">
            {eventsWithGroups.map((event, idx) => {
              const Icon = event.icon
              return (
                <div key={event.id}>
                  {event.showGroupHeader && (
                    <div className="flex items-center gap-3 py-2 first:pt-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{event.group}</span>
                      <div className="flex-1 h-px bg-border-subtle/60" />
                    </div>
                  )}
                  <div className="group relative flex items-start gap-3 rounded-xl py-2 pl-0 pr-1 transition-colors hover:bg-muted/40">
                    <div className="relative z-10 flex w-[30px] shrink-0 items-center justify-center">
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
      )}
    </div>
  )
}
