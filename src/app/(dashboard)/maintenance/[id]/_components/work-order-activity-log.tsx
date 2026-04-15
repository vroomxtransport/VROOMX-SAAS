'use client'

import { cn } from '@/lib/utils'
import {
  Activity,
  Plus,
  Pencil,
  Trash2,
  Workflow,
  Mail,
  Files,
  MessageSquare,
  Copy,
} from 'lucide-react'
import type { WorkOrderActivityAction } from '@/types'
import type { WorkOrderActivityLog } from '@/types/database'

const ACTION_CONFIG: Record<
  WorkOrderActivityAction,
  { icon: typeof Activity; dotColor: string; iconColor: string }
> = {
  created:            { icon: Plus,         dotColor: 'bg-blue-500',    iconColor: 'text-blue-500' },
  updated:            { icon: Pencil,       dotColor: 'bg-gray-400',    iconColor: 'text-gray-400' },
  deleted:            { icon: Trash2,       dotColor: 'bg-red-500',     iconColor: 'text-red-500' },
  status_changed:     { icon: Workflow,     dotColor: 'bg-amber-500',   iconColor: 'text-amber-500' },
  item_added:         { icon: Plus,         dotColor: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  item_updated:       { icon: Pencil,       dotColor: 'bg-gray-400',    iconColor: 'text-gray-400' },
  item_deleted:       { icon: Trash2,       dotColor: 'bg-red-500',     iconColor: 'text-red-500' },
  note_added:         { icon: MessageSquare, dotColor: 'bg-sky-500',    iconColor: 'text-sky-500' },
  note_deleted:       { icon: Trash2,       dotColor: 'bg-red-500',     iconColor: 'text-red-500' },
  duplicated:         { icon: Copy,         dotColor: 'bg-purple-500',  iconColor: 'text-purple-500' },
  attachment_added:   { icon: Files,        dotColor: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  attachment_deleted: { icon: Files,        dotColor: 'bg-red-500',     iconColor: 'text-red-500' },
  email_sent:         { icon: Mail,         dotColor: 'bg-purple-500',  iconColor: 'text-purple-500' },
}

const DEFAULT_CONFIG = {
  icon: Activity,
  dotColor: 'bg-gray-400',
  iconColor: 'text-gray-400',
}

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

interface WorkOrderActivityLogProps {
  activityLog: WorkOrderActivityLog[]
}

export function WorkOrderActivityLog({ activityLog }: WorkOrderActivityLogProps) {
  if (activityLog.length === 0) {
    return (
      <div className="widget-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Activity Log</h2>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="widget-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Activity Log</h2>
        <span className="ml-auto tabular-nums text-xs text-muted-foreground">
          {activityLog.length} events
        </span>
      </div>

      {/* Timeline */}
      <div className="relative max-h-[360px] overflow-y-auto px-4 py-3">
        {/* Vertical line */}
        <div className="absolute bottom-0 left-[23px] top-5 w-0.5 bg-gradient-to-b from-border via-border/50 to-transparent" />

        <div className="space-y-0">
          {activityLog.map((log, idx) => {
            const config =
              ACTION_CONFIG[log.action as WorkOrderActivityAction] ?? DEFAULT_CONFIG
            const Icon = config.icon

            return (
              <div key={log.id} className="relative flex items-start gap-3 py-2">
                {/* Dot */}
                <div className="relative z-10 flex shrink-0 items-center justify-center">
                  <span
                    className={cn(
                      'h-[9px] w-[9px] rounded-full ring-4 ring-surface',
                      config.dotColor,
                      idx === 0 && 'animate-pulse',
                    )}
                  />
                </div>

                {/* Content */}
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon
                      className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.iconColor)}
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground">{log.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {log.actor_email ?? 'system'}
                      </p>
                    </div>
                  </div>
                  <span className="mt-0.5 shrink-0 whitespace-nowrap tabular-nums text-xs text-muted-foreground">
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
