'use client'

import { StatCard } from '@/components/shared/stat-card'
import { Calendar, Wrench, CheckCircle2 } from 'lucide-react'
import { useMaintenanceCounts } from '@/hooks/use-maintenance'

export function MaintenanceStats() {
  const { data: counts } = useMaintenanceCounts()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Scheduled"
        value={counts?.scheduled ?? 0}
        icon={Calendar}
        accent="blue"
      />
      <StatCard
        label="In Progress"
        value={counts?.in_progress ?? 0}
        icon={Wrench}
        accent="amber"
      />
      <StatCard
        label="Completed"
        value={counts?.completed ?? 0}
        icon={CheckCircle2}
        accent="emerald"
      />
    </div>
  )
}
