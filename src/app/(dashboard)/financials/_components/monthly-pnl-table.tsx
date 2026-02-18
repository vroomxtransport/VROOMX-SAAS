'use client'

import { useMemo } from 'react'
import type { MonthlyPnLComputed } from '@/hooks/use-pnl'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  if (value === 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
    signDisplay: 'auto',
  }).format(value)
}

interface Props {
  data: MonthlyPnLComputed[]
}

interface RowDef {
  label: string
  key: string
  bold?: boolean
  highlight?: boolean
  indent?: boolean
}

const ROWS: RowDef[] = [
  { label: 'Revenue', key: 'revenue', bold: true },
  { label: 'Broker Fees', key: 'brokerFees', indent: true },
  { label: 'Local Fees', key: 'localFees', indent: true },
  { label: 'Clean Gross', key: 'cleanGross', bold: true, highlight: true },
  { label: 'Driver Pay', key: 'driverPay', indent: true },
  { label: 'Truck Gross', key: 'truckGross', bold: true, highlight: true },
  { label: 'Fixed Costs', key: 'fixedCosts' },
  { label: 'Trip Costs', key: 'directTripCosts' },
  { label: 'Carrier Pay', key: 'carrierPay' },
  { label: 'Total Operating', key: 'totalOperatingExpenses', bold: true },
  { label: 'Net Profit', key: 'netProfitBeforeTax', bold: true, highlight: true },
]

export function MonthlyPnLTable({ data }: Props) {
  // Group into quarters and compute QTR subtotals + YTD
  const { columns } = useMemo(() => {
    type Col = { label: string; pnl: Record<string, number>; isSubtotal?: boolean }
    const cols: Col[] = []
    const ytdPnl: Record<string, number> = {}

    for (const row of ROWS) {
      ytdPnl[row.key] = 0
    }

    let qtrIdx = 0
    const qtrPnl: Record<string, number> = {}
    for (const row of ROWS) {
      qtrPnl[row.key] = 0
    }

    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const pnlValues: Record<string, number> = {}

      for (const row of ROWS) {
        const val = (item.pnl as unknown as Record<string, number>)[row.key]
        pnlValues[row.key] = val
        qtrPnl[row.key] += val
        ytdPnl[row.key] += val
      }

      cols.push({ label: item.month.split(' ')[0], pnl: pnlValues })

      qtrIdx++
      if (qtrIdx === 3 || i === data.length - 1) {
        cols.push({
          label: `Q${Math.ceil((i + 1) / 3)}`,
          pnl: { ...qtrPnl },
          isSubtotal: true,
        })
        for (const row of ROWS) {
          qtrPnl[row.key] = 0
        }
        qtrIdx = 0
      }
    }

    cols.push({ label: 'YTD', pnl: { ...ytdPnl }, isSubtotal: true })

    return { columns: cols }
  }, [data])

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Monthly P&L</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground min-w-[120px]">
                Line Item
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-2 py-2 text-right font-medium text-muted-foreground min-w-[70px]',
                    col.isSubtotal && 'bg-muted/80 font-semibold'
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className={cn('border-b border-border/50', row.highlight && 'bg-muted/20')}>
                <td className={cn(
                  'sticky left-0 z-10 bg-card px-3 py-1.5',
                  row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  row.indent && 'pl-6',
                  row.highlight && 'bg-muted/20',
                )}>
                  {row.label}
                </td>
                {columns.map((col, i) => {
                  const val = col.pnl[row.key] ?? 0
                  return (
                    <td
                      key={i}
                      className={cn(
                        'px-2 py-1.5 text-right tabular-nums',
                        row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        col.isSubtotal && 'bg-muted/30 font-semibold',
                        row.key === 'netProfitBeforeTax' && val < 0 && 'text-red-600 dark:text-red-400',
                        row.key === 'netProfitBeforeTax' && val > 0 && 'text-green-600 dark:text-green-400',
                      )}
                    >
                      {fmt(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
