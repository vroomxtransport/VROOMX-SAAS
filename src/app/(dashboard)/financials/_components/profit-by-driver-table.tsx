'use client'

import { cn } from '@/lib/utils'
import type { ProfitByDriver } from '@/lib/queries/financials'
import { DRIVER_TYPE_LABELS } from '@/types'
import type { DriverType } from '@/types'
import Link from 'next/link'

interface ProfitByDriverTableProps {
  data: ProfitByDriver[]
}

function marginColor(margin: number): string {
  if (margin >= 10) return 'text-emerald-600'
  if (margin >= 5) return 'text-amber-600'
  return 'text-red-600'
}

export function ProfitByDriverTable({ data }: ProfitByDriverTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <h3 className="text-base font-semibold text-foreground mb-3">Profit by Driver</h3>
        <p className="text-sm text-muted-foreground py-8 text-center">No trip data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Profit by Driver</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Driver</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Revenue</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Driver Pay</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Margin</th>
              <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">Trips</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((driver) => (
              <tr key={driver.driverId} className="border-b border-border-subtle/50 last:border-0">
                <td className="py-2 pr-3">
                  <Link href={`/drivers`} className="font-medium text-foreground hover:text-brand transition-colors">
                    {driver.name}
                  </Link>
                </td>
                <td className="py-2 px-3">
                  <span className={cn(
                    'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                    driver.driverType === 'company'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                      : 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                  )}>
                    {DRIVER_TYPE_LABELS[driver.driverType as DriverType] ?? driver.driverType}
                  </span>
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-foreground">
                  ${driver.revenue.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  ${driver.driverPay.toLocaleString()}
                </td>
                <td className={cn('py-2 px-3 text-right tabular-nums font-medium', marginColor(driver.profitMargin))}>
                  {driver.profitMargin.toFixed(1)}%
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                  {driver.tripCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
