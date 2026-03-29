'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ChevronRight } from 'lucide-react'
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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0] ?? '').join('').toUpperCase().slice(0, 2)
}

const RANK_STYLES = [
  { badge: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30 shadow-sm', avatar: 'bg-gradient-to-br from-brand to-[#2a3a4f] text-white', bar: 'bg-gradient-to-r from-brand to-[#2a3a4f]' },
  { badge: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm', avatar: 'bg-violet-100 text-violet-700', bar: 'bg-gradient-to-r from-violet-500 to-violet-400' },
  { badge: 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-sm', avatar: 'bg-blue-100 text-blue-700', bar: 'bg-gradient-to-r from-blue-500 to-blue-400' },
]

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
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-[var(--accent-violet)]" />
          Top Drivers
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          MTD
        </span>
      </div>

      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No driver data this month</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden space-y-3">
          {drivers.map((driver, i) => {
            const pct = topRevenue > 0 ? (driver.revenue / topRevenue) * 100 : 0
            const style = RANK_STYLES[i] ?? { badge: 'bg-muted text-muted-foreground', avatar: 'bg-muted text-muted-foreground', bar: 'bg-gradient-to-r from-blue-500/50 to-blue-400/50' }

            return (
              <div key={driver.driverId} className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', style.badge)}>
                    {i + 1}
                  </span>
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', style.avatar)}>
                    {getInitials(driver.driverName)}
                  </span>
                  <Link
                    href={`/drivers/${driver.driverId}`}
                    className="flex-1 min-w-0 text-sm font-medium text-foreground hover:text-brand truncate"
                  >
                    {driver.driverName}
                  </Link>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(driver.revenue)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">{driver.loadCount} loads</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-border-subtle overflow-hidden ml-[3.75rem]">
                  <div
                    className={cn('h-1.5 rounded-full transition-all duration-500', style.bar)}
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
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-brand"
      >
        View All Drivers
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
