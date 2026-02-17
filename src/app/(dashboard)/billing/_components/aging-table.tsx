'use client'

import type { AgingRow } from '@/lib/queries/receivables'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

function formatCurrency(value: number): string {
  if (value === 0) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const BUCKET_STYLES = {
  current: 'text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400',
  '1_30': 'text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 dark:text-yellow-400',
  '31_60': 'text-orange-700 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400',
  '61_90': 'text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
  '90_plus': 'text-red-900 bg-red-100 dark:bg-red-950/30 dark:text-red-400',
} as const

interface AgingTableProps {
  aging: AgingRow[]
}

export function AgingTable({ aging }: AgingTableProps) {
  if (aging.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-surface py-8 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-muted-foreground">
          No aging data
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          No invoiced orders found
        </p>
      </div>
    )
  }

  // Compute totals row
  const totals = aging.reduce(
    (acc, row) => ({
      current: acc.current + row.current,
      '1_30': acc['1_30'] + row['1_30'],
      '31_60': acc['31_60'] + row['31_60'],
      '61_90': acc['61_90'] + row['61_90'],
      '90_plus': acc['90_plus'] + row['90_plus'],
      total: acc.total + row.total,
    }),
    { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, total: 0 }
  )

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Aging Analysis
      </h2>
      <div className="rounded-lg border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Broker</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">1-30 Days</TableHead>
              <TableHead className="text-right">31-60 Days</TableHead>
              <TableHead className="text-right">61-90 Days</TableHead>
              <TableHead className="text-right">90+ Days</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aging.map((row) => (
              <TableRow key={row.brokerId}>
                <TableCell className="font-medium">
                  {row.brokerName}
                </TableCell>
                <AgingCell value={row.current} bucket="current" />
                <AgingCell value={row['1_30']} bucket="1_30" />
                <AgingCell value={row['31_60']} bucket="31_60" />
                <AgingCell value={row['61_90']} bucket="61_90" />
                <AgingCell value={row['90_plus']} bucket="90_plus" />
                <TableCell className="text-right font-semibold">
                  {formatCurrency(row.total)}
                </TableCell>
              </TableRow>
            ))}

            {/* Totals Row */}
            <TableRow className="border-t-2 bg-muted/50 font-semibold">
              <TableCell>Total</TableCell>
              <AgingCell value={totals.current} bucket="current" bold />
              <AgingCell value={totals['1_30']} bucket="1_30" bold />
              <AgingCell value={totals['31_60']} bucket="31_60" bold />
              <AgingCell value={totals['61_90']} bucket="61_90" bold />
              <AgingCell value={totals['90_plus']} bucket="90_plus" bold />
              <TableCell className="text-right font-bold">
                {formatCurrency(totals.total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Aging Cell with color coding
// ============================================================================

interface AgingCellProps {
  value: number
  bucket: keyof typeof BUCKET_STYLES
  bold?: boolean
}

function AgingCell({ value, bucket, bold }: AgingCellProps) {
  if (value === 0) {
    return <TableCell className="text-right text-muted-foreground/60">-</TableCell>
  }

  return (
    <TableCell className="text-right">
      <span
        className={cn(
          'inline-block rounded px-2 py-0.5 text-sm',
          BUCKET_STYLES[bucket],
          bold && 'font-bold'
        )}
      >
        {formatCurrency(value)}
      </span>
    </TableCell>
  )
}
