'use client'

import { useFuelStats } from '@/hooks/use-fuel'
import { StatCard } from '@/components/shared/stat-card'
import { Fuel, DollarSign, TrendingUp } from 'lucide-react'

export function FuelStats() {
  const { data } = useFuelStats()

  const totalGallons = data?.totalGallons ?? 0
  const totalCost = data?.totalCost ?? 0
  const avgCostPerGallon = data?.avgCostPerGallon ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Total Gallons"
        value={totalGallons.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        icon={Fuel}
        accent="blue"
      />
      <StatCard
        label="Total Cost"
        value={`$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        icon={DollarSign}
        accent="amber"
      />
      <StatCard
        label="Avg $/Gallon"
        value={`$${avgCostPerGallon.toFixed(3)}`}
        icon={TrendingUp}
        accent="emerald"
      />
    </div>
  )
}
