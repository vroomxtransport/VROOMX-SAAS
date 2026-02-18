'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchOrderActivityLog } from '@/lib/queries/orders'
import { cn } from '@/lib/utils'
import {
  Activity,
  PlusCircle,
  Pencil,
  ArrowRight,
  Undo2,
  Truck,
  Unlink,
  DollarSign,
  CheckCircle2,
  FileText,
  Receipt,
  Trash2,
} from 'lucide-react'
import type { OrderActivityAction } from '@/types'

const ACTION_CONFIG: Record<OrderActivityAction, { icon: typeof Activity; dotColor: string; iconColor: string }> = {
  order_created: { icon: PlusCircle, dotColor: 'bg-blue-500', iconColor: 'text-blue-500' },
  order_updated: { icon: Pencil, dotColor: 'bg-gray-400', iconColor: 'text-gray-400' },
  order_deleted: { icon: Trash2, dotColor: 'bg-red-500', iconColor: 'text-red-500' },
  status_changed: { icon: ArrowRight, dotColor: 'bg-blue-500', iconColor: 'text-blue-500' },
  status_rolled_back: { icon: Undo2, dotColor: 'bg-amber-500', iconColor: 'text-amber-500' },
  assigned_to_trip: { icon: Truck, dotColor: 'bg-amber-500', iconColor: 'text-amber-500' },
  unassigned_from_trip: { icon: Unlink, dotColor: 'bg-amber-500', iconColor: 'text-amber-500' },
  payment_recorded: { icon: DollarSign, dotColor: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  batch_marked_paid: { icon: CheckCircle2, dotColor: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  invoice_sent: { icon: FileText, dotColor: 'bg-purple-500', iconColor: 'text-purple-500' },
  order_factored: { icon: Receipt, dotColor: 'bg-purple-500', iconColor: 'text-purple-500' },
}

const DEFAULT_CONFIG = { icon: Activity, dotColor: 'bg-gray-400', iconColor: 'text-gray-400' }

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface OrderActivityLogProps {
  orderId: string
}

export function OrderActivityLog({ orderId }: OrderActivityLogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: logs, isLoading } = useQuery({
    queryKey: ['order-activity-log', orderId],
    queryFn: () => fetchOrderActivityLog(supabase, orderId),
    staleTime: 30_000,
  })

  // Realtime subscription for new activity logs
  useEffect(() => {
    const channel = supabase
      .channel(`order-activity-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_activity_logs',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order-activity-log', orderId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, orderId])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Activity Log</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="h-2.5 w-2.5 rounded-full bg-muted mt-1.5" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Activity Log</h2>
        </div>
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Activity Log</h2>
        <span className="ml-auto text-xs text-muted-foreground">{logs.length} events</span>
      </div>
      <div className="relative max-h-[400px] overflow-y-auto pr-1">
        {/* Timeline line */}
        <div className="absolute left-[11px] top-4 bottom-0 w-0.5 bg-gradient-to-b from-border-subtle via-border-subtle/50 to-transparent" />

        <div className="space-y-0">
          {logs.map((log, idx) => {
            const config = ACTION_CONFIG[log.action as OrderActivityAction] ?? DEFAULT_CONFIG
            const Icon = config.icon

            return (
              <div key={log.id} className="relative flex items-start gap-3 py-2">
                {/* Dot */}
                <div className="relative z-10 flex items-center justify-center">
                  <span
                    className={cn(
                      'h-[9px] w-[9px] rounded-full ring-4 ring-surface',
                      config.dotColor,
                      idx === 0 && 'animate-pulse'
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 flex items-start justify-between gap-3 min-w-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', config.iconColor)} />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{log.description}</p>
                      {log.actor_email && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {log.actor_email}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                    {formatRelativeTime(log.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
