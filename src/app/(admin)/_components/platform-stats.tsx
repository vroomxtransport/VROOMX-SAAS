import { StatCard } from '@/components/shared/stat-card'
import { Building2, CheckCircle, DollarSign, AlertTriangle } from 'lucide-react'

interface PlatformStatsProps {
  totalTenants: number
  activeSubscriptions: number
  mrr: number
  atRiskCount: number
  signupTrend: number
}

export function PlatformStats({
  totalTenants,
  activeSubscriptions,
  mrr,
  atRiskCount,
  signupTrend,
}: PlatformStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Tenants"
        value={totalTenants.toLocaleString()}
        sublabel={`+${signupTrend} this month`}
        icon={Building2}
        accent="blue"
      />
      <StatCard
        label="Active Subscriptions"
        value={activeSubscriptions.toLocaleString()}
        sublabel={`${totalTenants > 0 ? Math.round((activeSubscriptions / totalTenants) * 100) : 0}% of tenants`}
        icon={CheckCircle}
        accent="emerald"
      />
      <StatCard
        label="MRR"
        value={`$${mrr.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
        sublabel="Monthly recurring revenue"
        icon={DollarSign}
        accent="violet"
      />
      <StatCard
        label="At-Risk Tenants"
        value={atRiskCount}
        sublabel={atRiskCount === 0 ? 'All clear' : 'Needs attention'}
        icon={AlertTriangle}
        accent="amber"
      />
    </div>
  )
}
