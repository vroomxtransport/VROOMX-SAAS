'use client'

import { useTaskCounts } from '@/hooks/use-tasks'
import { StatCard } from '@/components/shared/stat-card'
import { ClipboardList, CalendarClock, AlertTriangle, Flame } from 'lucide-react'

export function TaskStats() {
  const { data: counts } = useTaskCounts()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Pending"
        value={counts?.pending ?? 0}
        icon={ClipboardList}
        accent="blue"
      />
      <StatCard
        label="Due Today"
        value={counts?.dueToday ?? 0}
        icon={CalendarClock}
        accent="amber"
      />
      <StatCard
        label="Overdue"
        value={counts?.overdue ?? 0}
        icon={AlertTriangle}
        accent="violet"
      />
      <StatCard
        label="Urgent"
        value={counts?.urgent ?? 0}
        icon={Flame}
        accent="emerald"
      />
    </div>
  )
}
