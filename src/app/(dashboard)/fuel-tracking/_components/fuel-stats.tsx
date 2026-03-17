'use client'

import { useFuelStats } from '@/hooks/use-fuel'
import { useFuelPricing } from '@/hooks/use-fuel-pricing'
import { StatCard } from '@/components/shared/stat-card'
import { Fuel, DollarSign, TrendingUp, Globe, ArrowDown, ArrowUp } from 'lucide-react'

export function FuelStats() {
  const { data } = useFuelStats()
  const { data: pricing, isLoading: pricingLoading } = useFuelPricing()

  const totalGallons = data?.totalGallons ?? 0
  const totalCost = data?.totalCost ?? 0
  const avgCostPerGallon = data?.avgCostPerGallon ?? 0
  const nationalAvg = pricing?.dieselPrice ?? 0
  const delta = avgCostPerGallon > 0 && nationalAvg > 0 ? avgCostPerGallon - nationalAvg : 0
  const isSaving = delta < 0

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* National average diesel price from EIA */}
      <div className="widget-card flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <Globe className="h-4 w-4 text-violet-500" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            National Avg Diesel
          </span>
        </div>

        {pricingLoading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : nationalAvg > 0 ? (
          <>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              ${nationalAvg.toFixed(3)}
            </p>

            {/* Comparison with fleet avg */}
            {avgCostPerGallon > 0 && delta !== 0 && (
              <div className="flex items-center gap-1.5">
                {isSaving ? (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
                    <ArrowDown className="h-3 w-3" />
                    ${Math.abs(delta).toFixed(3)} below
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-xs font-medium text-red-500">
                    <ArrowUp className="h-3 w-3" />
                    ${Math.abs(delta).toFixed(3)} above
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">vs your avg</span>
              </div>
            )}

            {pricing?.date && (
              <p className="text-[10px] text-muted-foreground">
                EIA weekly · {new Date(pricing.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Unavailable</p>
        )}
      </div>
    </div>
  )
}
