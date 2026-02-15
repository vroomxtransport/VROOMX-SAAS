'use client'

import { cn } from '@/lib/utils'
import type { ProfitByTruck } from '@/lib/queries/financials'
import Link from 'next/link'

interface ProfitByTruckTableProps {
  data: ProfitByTruck[]
}

function marginColor(margin: number): string {
  if (margin >= 10) return 'text-emerald-600'
  if (margin >= 5) return 'text-amber-600'
  return 'text-red-600'
}

export function ProfitByTruckTable({ data }: ProfitByTruckTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <h3 className="text-base font-semibold text-foreground mb-3">Profit by Truck</h3>
        <p className="text-sm text-muted-foreground py-8 text-center">No trip data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="text-base font-semibold text-foreground mb-3">Profit by Truck</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="py-2 pr-3 text-left text-xs font-medium text-muted-foreground">Truck</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Revenue</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Expenses</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Profit</th>
              <th className="py-2 px-3 text-right text-xs font-medium text-muted-foreground">Margin</th>
              <th className="py-2 pl-3 text-right text-xs font-medium text-muted-foreground">Trips</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((truck) => (
              <tr key={truck.truckId} className="border-b border-border-subtle/50 last:border-0">
                <td className="py-2 pr-3">
                  <Link href={`/trucks`} className="font-medium text-foreground hover:text-brand transition-colors">
                    {truck.unitNumber}
                  </Link>
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-foreground">
                  ${truck.revenue.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  ${truck.expenses.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-medium text-foreground">
                  ${truck.profit.toLocaleString()}
                </td>
                <td className={cn('py-2 px-3 text-right tabular-nums font-medium', marginColor(truck.margin))}>
                  {truck.margin.toFixed(1)}%
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                  {truck.tripCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
