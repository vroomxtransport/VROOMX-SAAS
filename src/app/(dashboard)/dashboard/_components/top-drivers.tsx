'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { User } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DriverRevenue {
  driverId: string
  driverName: string
  loadCount: number
  revenue: number
}

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function TopDrivers() {
  const supabase = createClient()

  const { data: drivers = [] } = useQuery({
    queryKey: ['dashboard', 'top-drivers-mtd'],
    queryFn: async (): Promise<DriverRevenue[]> => {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('revenue, driver_id, driver:drivers(id, first_name, last_name)')
        .not('driver_id', 'is', null)
        .gte('created_at', startOfMonth.toISOString())

      if (error) throw error

      const driverMap = new Map<string, DriverRevenue>()

      for (const order of orders ?? []) {
        const driverRaw = order.driver as unknown as
          | { id: string; first_name: string; last_name: string }
          | { id: string; first_name: string; last_name: string }[]
          | null
        const driver = Array.isArray(driverRaw) ? driverRaw[0] ?? null : driverRaw
        if (!driver) continue

        const existing = driverMap.get(driver.id)
        const rev = parseFloat(order.revenue ?? '0')

        if (existing) {
          existing.loadCount += 1
          existing.revenue += rev
        } else {
          driverMap.set(driver.id, {
            driverId: driver.id,
            driverName: `${driver.first_name} ${driver.last_name}`,
            loadCount: 1,
            revenue: rev,
          })
        }
      }

      return Array.from(driverMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
    },
    staleTime: 30_000,
  })

  const topRevenue = drivers[0]?.revenue ?? 1

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Top Drivers</h3>
        <div className="rounded-lg p-1.5 bg-[var(--accent-violet-bg)]">
          <User className="h-4 w-4 text-[var(--accent-violet)]" />
        </div>
      </div>

      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No driver data this month</p>
      ) : (
        <div className="space-y-2.5">
          {drivers.map((driver, i) => {
            const pct = topRevenue > 0 ? (driver.revenue / topRevenue) * 100 : 0
            return (
              <div key={driver.driverId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      i === 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {i + 1}
                    </span>
                    <Link
                      href={`/drivers/${driver.driverId}`}
                      className="text-sm font-medium text-foreground hover:text-brand truncate"
                    >
                      {driver.driverName}
                    </Link>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(driver.revenue)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({driver.loadCount})</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-border-subtle overflow-hidden">
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-500',
                      i === 0
                        ? 'bg-gradient-to-r from-violet-500 to-violet-400'
                        : 'bg-gradient-to-r from-blue-500/60 to-blue-400/60'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href="/drivers"
        className="mt-3 block text-center text-xs font-medium text-brand hover:underline"
      >
        View All Drivers →
      </Link>
    </div>
  )
}
