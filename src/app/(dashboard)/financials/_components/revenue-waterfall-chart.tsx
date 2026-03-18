'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from 'recharts'
import type { PnLOutput } from '@/lib/financial/pnl-calculations'

function fmt(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`
  }
  return `$${value.toFixed(0)}`
}

function fmtFull(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
}

interface WaterfallEntry {
  name: string
  value: number
  fill: string
  label: number | null
}

interface Props {
  pnl: PnLOutput
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-3 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">
        {fmtFull(payload[0].value)}
      </p>
    </div>
  )
}

export function RevenueWaterfallChart({ pnl }: Props) {
  const data = useMemo((): WaterfallEntry[] => {
    const raw: Array<{ name: string; value: number; fill: string; showLabel?: boolean }> = [
      { name: 'Revenue', value: pnl.revenue, fill: 'url(#greenGradient)', showLabel: true },
      { name: 'Broker', value: -pnl.brokerFees, fill: 'url(#redGradient)' },
      { name: 'Local', value: -pnl.localFees, fill: 'url(#redGradient)' },
      { name: 'Clean Gross', value: pnl.cleanGross, fill: 'url(#blueGradient)', showLabel: true },
      { name: 'Driver', value: -pnl.driverPay, fill: 'url(#redGradient)' },
      { name: 'Truck Gross', value: pnl.truckGross, fill: 'url(#blueGradient)' },
      { name: 'Fixed', value: -pnl.fixedCosts, fill: 'url(#redGradient)' },
      { name: 'Trip Costs', value: -pnl.directTripCosts, fill: 'url(#redGradient)' },
      { name: 'Net Profit', value: pnl.netProfitBeforeTax, fill: pnl.netProfitBeforeTax >= 0 ? 'url(#greenGradient)' : 'url(#redGradient)', showLabel: true },
    ]
    return raw
      .filter((d) => d.value !== 0)
      .map((d) => ({
        name: d.name,
        value: d.value,
        fill: d.fill,
        label: d.showLabel ? d.value : null,
      }))
  }, [pnl])

  return (
    <div className="widget-card p-5">
      <div className="widget-header !border-b-0 !px-0 !pb-4">
        <div className="widget-title">
          <div className="widget-accent-dot" />
          Revenue Waterfall
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 24, right: 10, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle, #e5e7eb)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#7a7a7a' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#7a7a7a' }}
            tickFormatter={fmt}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <ReferenceLine y={0} stroke="#e5e5e5" strokeDasharray="4 4" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.fill}
              />
            ))}
            <LabelList
              dataKey="label"
              formatter={(val: unknown) => typeof val === 'number' ? fmt(val) : ''}
              position="top"
              fontSize={11}
              fontWeight={600}
              fill="var(--foreground, #333)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
