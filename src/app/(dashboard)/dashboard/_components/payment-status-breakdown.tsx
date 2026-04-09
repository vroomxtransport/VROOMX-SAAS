'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchPaymentStatusBreakdown } from '@/lib/queries/receivables'
import type { PaymentStatusBreakdown as PaymentStatusData } from '@/lib/queries/receivables'
import { PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const STATUS_CONFIG: Record<string, { label: string; color: string; ring: string }> = {
  unpaid:         { label: 'Unpaid',         color: '#64748b', ring: 'ring-slate-500/20' },
  invoiced:       { label: 'Invoiced',       color: '#3b82f6', ring: 'ring-blue-500/20' },
  partially_paid: { label: 'Partial',        color: '#f59e0b', ring: 'ring-amber-500/20' },
  paid:           { label: 'Paid',           color: '#10b981', ring: 'ring-emerald-500/20' },
}

function getStatusMeta(status: string) {
  return STATUS_CONFIG[status] ?? { label: status, color: '#94a3b8', ring: 'ring-slate-400/20' }
}

interface DonutSegment {
  status: string
  label: string
  count: number
  amount: number
  color: string
  ring: string
  startAngle: number
  endAngle: number
}

function buildSegments(data: PaymentStatusData[]): DonutSegment[] {
  const totalCount = data.reduce((sum, d) => sum + d.count, 0)
  if (totalCount === 0) return []

  // Sort in a stable order: unpaid, invoiced, partially_paid, paid, then any extras
  const ORDER = ['unpaid', 'invoiced', 'partially_paid', 'paid']
  const sorted = [...data].sort((a, b) => {
    const ai = ORDER.indexOf(a.status)
    const bi = ORDER.indexOf(b.status)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  let currentAngle = 0
  return sorted.map((d) => {
    const meta = getStatusMeta(d.status)
    const sweep = (d.count / totalCount) * 360
    const segment: DonutSegment = {
      status: d.status,
      label: meta.label,
      count: d.count,
      amount: d.amount,
      color: meta.color,
      ring: meta.ring,
      startAngle: currentAngle,
      endAngle: currentAngle + sweep,
    }
    currentAngle += sweep
    return segment
  })
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const startRad = ((startDeg - 90) * Math.PI) / 180
  const endRad = ((endDeg - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}

function DonutChart({ segments, totalCount }: { segments: DonutSegment[]; totalCount: number }) {
  const CX = 50
  const CY = 50
  const R = 38
  const STROKE_WIDTH = 10

  // If only one segment, render a full circle
  if (segments.length === 1) {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={segments[0].color}
          strokeWidth={STROKE_WIDTH}
        />
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          className="fill-foreground text-lg font-bold"
          style={{ fontSize: '18px' }}
        >
          {totalCount}
        </text>
        <text
          x={CX}
          y={CY + 10}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '8px' }}
        >
          orders
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {/* Background track */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={STROKE_WIDTH}
      />
      {/* Segments */}
      {segments.map((seg) => {
        // Avoid rendering arcs with nearly zero sweep
        if (seg.endAngle - seg.startAngle < 0.5) return null
        return (
          <path
            key={seg.status}
            d={describeArc(CX, CY, R, seg.startAngle, seg.endAngle)}
            fill="none"
            stroke={seg.color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="butt"
            className="transition-all duration-500"
          />
        )
      })}
      {/* Center text */}
      <text
        x={CX}
        y={CY - 4}
        textAnchor="middle"
        className="fill-foreground font-bold"
        style={{ fontSize: '18px' }}
      >
        {totalCount}
      </text>
      <text
        x={CX}
        y={CY + 10}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: '8px' }}
      >
        orders
      </text>
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-violet-500" />
          Payment Status
        </span>
        <div className="rounded-lg p-1.5 bg-violet-50">
          <PieChart className="h-4 w-4 text-violet-500" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    </div>
  )
}

export function PaymentStatusBreakdown() {
  const supabase = createClient()

  const { data: statusData = [], isLoading } = useQuery({
    queryKey: ['dashboard', 'payment-status'],
    queryFn: () => fetchPaymentStatusBreakdown(supabase),
    staleTime: 30_000,
  })

  const segments = buildSegments(statusData)
  const totalCount = statusData.reduce((sum, d) => sum + d.count, 0)

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="widget-card h-full flex flex-col">
      <div className="widget-header">
        <span className="widget-title">
          <span className="widget-accent-dot bg-violet-500" />
          Payment Status
        </span>
        <div className="rounded-lg p-1.5 bg-violet-50">
          <PieChart className="h-4 w-4 text-violet-500" />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <PieChart className="h-8 w-8 opacity-40" />
          <p className="text-sm">No order data available</p>
        </div>
      ) : (
        <>
          {/* Donut */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-2">
            <div className="h-28 w-28">
              <DonutChart segments={segments} totalCount={totalCount} />
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 pt-3 border-t border-border-subtle">
            {segments.map((seg) => (
              <div
                key={seg.status}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full shrink-0 ring-2', seg.ring)}
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-sm text-foreground truncate">{seg.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {seg.count}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {fmt(seg.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
