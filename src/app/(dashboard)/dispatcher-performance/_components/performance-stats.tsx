'use client'

import { StatCard } from '@/components/shared/stat-card'
import { PackageSearch, CheckCircle, Clock, DollarSign } from 'lucide-react'

export function PerformanceStats() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Orders"
        value={0}
        sublabel="All assigned orders"
        icon={PackageSearch}
        accent="blue"
      />
      <StatCard
        label="Avg Completion"
        value="0%"
        sublabel="Orders completed"
        icon={CheckCircle}
        accent="amber"
      />
      <StatCard
        label="On-Time %"
        value="0%"
        sublabel="Delivered on schedule"
        icon={Clock}
        accent="violet"
      />
      <StatCard
        label="Revenue"
        value="$0"
        sublabel="Total team revenue"
        icon={DollarSign}
        accent="emerald"
      />
    </div>
  )
}
