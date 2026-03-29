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
  group?: 'revenue' | 'expense' | 'summary'
  isGroupHeader?: boolean
  isSubtotal?: boolean
}

const ROWS: RowDef[] = [
  { label: 'Revenue', key: 'revenue', bold: true, group: 'revenue', isGroupHeader: true },
  { label: 'Broker Fees', key: 'brokerFees', indent: true, group: 'revenue' },
  { label: 'Local Fees', key: 'localFees', indent: true, group: 'revenue' },
  { label: 'Clean Gross', key: 'cleanGross', bold: true, highlight: true, group: 'revenue', isSubtotal: true },
  { label: 'Driver Pay', key: 'driverPay', indent: true, group: 'revenue' },
  { label: 'Truck Gross', key: 'truckGross', bold: true, highlight: true, group: 'revenue', isSubtotal: true },
  { label: 'Fixed Costs', key: 'fixedCosts', group: 'expense' },
  { label: 'Trip Costs', key: 'directTripCosts', group: 'expense' },
  { label: 'Carrier Pay', key: 'carrierPay', group: 'expense' },
  { label: 'Total Operating', key: 'totalOperatingExpenses', bold: true, group: 'expense', isSubtotal: true },
  { label: 'Net Profit', key: 'netProfitBeforeTax', bold: true, highlight: true, group: 'summary' },
]

export function MonthlyPnLTable({ data }: Props) {
  // Group into quarters and compute QTR subtotals + YTD
  const { columns } = useMemo(() => {
    type Col = { label: string; pnl: Record<string, number>; isSubtotal?: boolean; isYTD?: boolean }
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

    cols.push({ label: 'YTD', pnl: { ...ytdPnl }, isSubtotal: true, isYTD: true })

    return { columns: cols }
  }, [data])

  // Determine which group the previous row belonged to for visual separation
  const groupBoundaries = new Set<number>()
  for (let i = 1; i < ROWS.length; i++) {
    if (ROWS[i].group !== ROWS[i - 1].group) {
      groupBoundaries.add(i)
    }
  }

  return (
    <div className="widget-card overflow-hidden">
      <div className="widget-header">
        <div className="widget-title">
          <div className="widget-accent-dot" />
          Monthly P&amp;L
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[120px]">
                Line Item
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    'px-2 py-2.5 text-right font-medium text-muted-foreground min-w-[70px]',
                    col.isSubtotal && !col.isYTD && 'bg-muted/20 font-semibold',
                    col.isYTD && 'bg-brand/5 font-bold',
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, rowIdx) => (
              <tr
                key={row.key}
                className={cn(
                  'border-b border-border/50',
                  groupBoundaries.has(rowIdx) && 'border-t-2 border-t-border',
                  row.isGroupHeader && 'bg-muted/30',
                  row.isSubtotal && !row.highlight && 'bg-muted/50',
                  row.key === 'netProfitBeforeTax' && 'bg-emerald-50/50',
                )}
              >
                <td className={cn(
                  'sticky left-0 z-10 px-3 py-2',
                  row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  row.indent && 'pl-6',
                  row.isGroupHeader && 'bg-muted/30',
                  row.isSubtotal && !row.highlight && 'bg-muted/50',
                  row.key === 'netProfitBeforeTax' && 'bg-emerald-50/50',
                  !row.isGroupHeader && !row.isSubtotal && row.key !== 'netProfitBeforeTax' && 'bg-card',
                )}>
                  {row.label}
                </td>
                {columns.map((col, i) => {
                  const val = col.pnl[row.key] ?? 0
                  const isNegative = val < 0
                  const isZero = val === 0
                  const isNetProfit = row.key === 'netProfitBeforeTax'
                  return (
                    <td
                      key={i}
                      className={cn(
                        'px-2 py-2 text-right tabular-nums',
                        row.bold ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        col.isSubtotal && !col.isYTD && 'bg-muted/20 font-semibold',
                        col.isYTD && 'bg-brand/5 font-bold',
                        isNegative && !isNetProfit && 'text-red-600',
                        isZero && 'text-muted-foreground',
                        isNetProfit && val < 0 && 'text-red-600',
                        isNetProfit && val > 0 && 'text-green-600',
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
