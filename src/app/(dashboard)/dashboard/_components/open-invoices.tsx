'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchOutstandingAR, fetchReadyToInvoice } from '@/lib/queries/receivables'
import { DollarSign, FileText, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function OpenInvoices() {
  const supabase = createClient()

  const { data: outstanding = 0 } = useQuery({
    queryKey: ['dashboard', 'outstanding-ar'],
    queryFn: () => fetchOutstandingAR(supabase),
    staleTime: 30_000,
  })

  const { data: readyToInvoice = [] } = useQuery({
    queryKey: ['dashboard', 'ready-to-invoice'],
    queryFn: () => fetchReadyToInvoice(supabase),
    staleTime: 30_000,
  })

  const readyCount = readyToInvoice.length
  const readyTotal = readyToInvoice.reduce((sum, o) => sum + o.carrierPay, 0)

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">Open Invoices</h3>
        <div className="rounded-lg p-1.5 bg-[var(--accent-amber-bg)]">
          <DollarSign className="h-4 w-4 text-[var(--accent-amber)]" />
        </div>
      </div>

      <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(outstanding)}</p>
      <p className="text-xs text-muted-foreground mt-0.5">Outstanding receivables</p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-muted/30 dark:bg-muted/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-sm text-muted-foreground">Ready to invoice</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold tabular-nums text-foreground">{readyCount}</span>
            {readyTotal > 0 && (
              <span className="text-xs text-muted-foreground ml-1">({fmt(readyTotal)})</span>
            )}
          </div>
        </div>

        {outstanding > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/30 dark:bg-muted/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn('h-3.5 w-3.5', outstanding > 5000 ? 'text-red-500' : 'text-amber-500')} />
              <span className="text-sm text-muted-foreground">Total owed</span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">{fmt(outstanding)}</span>
          </div>
        )}
      </div>

      <Link
        href="/billing"
        className="mt-3 block text-center text-xs font-medium text-brand hover:underline"
      >
        View Billing →
      </Link>
    </div>
  )
}
