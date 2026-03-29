'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchOutstandingAR, fetchReadyToInvoice } from '@/lib/queries/receivables'
import { DollarSign, FileText, AlertTriangle, ChevronRight } from 'lucide-react'
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
  const readyTotal = readyToInvoice.reduce((sum, o) => sum + o.invoiceableAmount, 0)

  // Donut gauge math
  const maxAR = Math.max(outstanding, 10000)
  const ratio = Math.min(outstanding / maxAR, 1)
  const circumference = 2 * Math.PI * 40
  const strokeOffset = circumference * (1 - ratio)

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-[var(--accent-amber)]" />
          Open Invoices
        </span>
        <div className="rounded-lg p-1.5 bg-[var(--accent-amber-bg)]">
          <DollarSign className="h-4 w-4 text-[var(--accent-amber)]" />
        </div>
      </div>

      {/* Donut gauge */}
      <div className="flex-1 min-h-0 flex items-center gap-4 mb-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="8"
            />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="url(#invoiceGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="invoiceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#192334" />
                <stop offset="100%" stopColor="#2a3a4f" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold tabular-nums text-foreground">{Math.round(ratio * 100)}%</span>
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{fmt(outstanding)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Outstanding receivables</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-xl border-l-2 border-l-blue-500 bg-muted/30 px-3 py-2.5">
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
          <div className="flex items-center justify-between rounded-xl border-l-2 border-l-amber-500 bg-muted/30 px-3 py-2.5">
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
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 hover:text-brand"
      >
        View Billing
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
