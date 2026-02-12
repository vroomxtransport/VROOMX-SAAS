'use client'

import { cn } from '@/lib/utils'

interface CollectionRateProps {
  totalInvoiced: number
  totalCollected: number
  rate: number
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`
  }
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function CollectionRate({
  totalInvoiced,
  totalCollected,
  rate,
}: CollectionRateProps) {
  const color =
    rate >= 80
      ? 'text-green-700 bg-green-50 border-green-200'
      : rate >= 60
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200'

  return (
    <div className={cn('rounded-lg border px-5 py-3 text-right', color)}>
      <p className="text-3xl font-bold">{rate}%</p>
      <p className="text-xs font-medium">Collection Rate</p>
      <p className="mt-1 text-xs opacity-75">
        {formatCompact(totalCollected)} collected of{' '}
        {formatCompact(totalInvoiced)} invoiced
      </p>
    </div>
  )
}
